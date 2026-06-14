function addChaptersFunctions(AblePlayer) {

	AblePlayer.prototype.populateChaptersDiv = function() {

		var headingLevel, headingType, headingId, chaptersHeading;
		if ( ! this.chaptersDivLocation ) {
			return;
		}
		if (document.getElementById(this.chaptersDivLocation)) {

			this.chaptersDiv = document.getElementById(this.chaptersDivLocation);
			this.chaptersDiv.classList.add('able-chapters-div');

			// empty content from previous build before starting fresh
			this.chaptersDiv.innerHTML = '';

			// add optional header
			if (this.chaptersTitle) {
				headingLevel = this.getNextHeadingLevel(this.chaptersDiv);
				headingType = 'h' + headingLevel.toString();
				headingId = this.mediaId + '-chapters-heading';
				chaptersHeading = this.createEl(headingType, {
					'class': 'able-chapters-heading',
					'id': headingId,
					text: this.chaptersTitle
				});
				this.chaptersDiv.append(chaptersHeading);
			}

			this.chaptersNav = this.createEl('nav');
			if (this.chaptersTitle) {
				this.chaptersNav.setAttribute( 'aria-labelledby', headingId );
			} else {
				this.chaptersNav.setAttribute( 'aria-label', this.translate( 'chapters', 'Chapters' ) );
			}
			this.chaptersDiv.append(this.chaptersNav);

			// populate this.chaptersNav with a list of chapters
			this.updateChaptersList();
		}
	};

	AblePlayer.prototype.updateChaptersList = function() {

		var thisObj, cues, chaptersList, c, thisChapter,
			chapterItem, chapterButton, hasDefault,
			getClickFunction;

		thisObj = this;

		// TODO: Update this so it can change the chapters popup menu
		// currently it only works if chapters are in an external container
		if (!this.chaptersNav) {
			return false;
		}

		if (typeof this.useChapterTimes === 'undefined') {
			this.useChapterTimes = (this.seekbarScope === 'chapter' && this.selectedChapters.cues.length) ? true : false;
		}
		if (this.useChapterTimes) {
			cues = this.selectedChapters.cues;
		} else if (this.chapters.length >= 1) {
			cues = this.chapters[0].cues;
		} else {
			cues = [];
		}
		if (cues.length > 0) {
			chaptersList = this.createEl('ul');
			for (c = 0; c < cues.length; c++) {
				thisChapter = c;
				chapterItem = this.createEl('li');
				chapterButton = this.createEl('button', {
					'type': 'button',
					'val': thisChapter,
					text: this.flattenCueForCaption(cues[thisChapter])
				});

				// add event listeners
				getClickFunction = function (time) {
					return function () {
						var clickedItem, listItems, i;
						thisObj.seekTrigger = 'chapter';
						clickedItem = this.closest('li');
						listItems = Array.from(this.closest('ul').querySelectorAll('li'));
						for (i = 0; i < listItems.length; i++) {
							listItems[i].classList.remove('able-current-chapter');
							Array.from(listItems[i].children).forEach(function (child) {
								if (child.matches('button')) {
									child.removeAttribute('aria-current');
								}
							});
						}
						clickedItem.classList.add('able-current-chapter');
						Array.from(clickedItem.children).forEach(function (child) {
							if (child.matches('button')) {
								child.setAttribute('aria-current', 'true');
							}
						});
						// Need to updateChapter before seeking to it
						// Otherwise seekBar is redrawn with wrong chapterDuration and/or chapterTime
						thisObj.updateChapter(time);
						thisObj.seekTo(time);
					}
				};
				chapterButton.addEventListener('click', getClickFunction(cues[thisChapter].start)); // works with Enter too
				chapterButton.addEventListener('focus', function() {
					Array.from(this.closest('ul').querySelectorAll('li')).forEach(function (li) {
						li.classList.remove('able-focus');
					});
					this.closest('li').classList.add('able-focus');
				});
				chapterItem.addEventListener('hover', function() {
					Array.from(this.closest('ul').querySelectorAll('li')).forEach(function (li) {
						li.classList.remove('able-focus');
					});
					this.classList.add('able-focus');
				});
				chapterItem.addEventListener('mouseleave', function() {
					this.classList.remove('able-focus');
				});
				chapterButton.addEventListener('blur', function() {
					this.closest('li').classList.remove('able-focus');
				});

				// put it all together
				chapterItem.append(chapterButton);
				chaptersList.append(chapterItem);
				if (this.defaultChapter === cues[thisChapter].id) {
					chapterButton.setAttribute('aria-current', 'true');
					if (chapterButton.parentElement && chapterButton.parentElement.matches('li')) {
						chapterButton.parentElement.classList.add('able-current-chapter');
					}
					this.currentChapter = cues[thisChapter];
					hasDefault = true;
				}
			}
			if (!hasDefault) {
				// select the first chapter
				this.currentChapter = cues[0];
				var firstButton = chaptersList.querySelector('button');
				if (firstButton) {
					firstButton.setAttribute('aria-current', 'true');
					if (firstButton.parentElement && firstButton.parentElement.matches('li')) {
						firstButton.parentElement.classList.add('able-current-chapter');
					}
				}
			}
			this.chaptersNav.innerHTML = '';
			this.chaptersNav.append(chaptersList);
		}
		return false;
	};

	AblePlayer.prototype.seekToChapter = function(chapterId) {

		// step through chapters looking for matching ID
		var i=0;
		while (i < this.selectedChapters.cues.length) {
			if (this.selectedChapters.cues[i].id == chapterId) {
				// found the target chapter! Seek to it
				this.seekTo(this.selectedChapters.cues[i].start);
				this.updateChapter(this.selectedChapters.cues[i].start);
				break;
			}
			i++;
		}
	};

	AblePlayer.prototype.updateChapter = function (now) {

		// as time-synced chapters change during playback, track changes in current chapter
		if (typeof this.selectedChapters === 'undefined') {
			return;
		}

		var chapters, i, thisChapterIndex;

		chapters = this.selectedChapters.cues;
		for (i = 0; i < chapters.length; i++) {
			if ((chapters[i].start <= now) && (chapters[i].end > now)) {
				thisChapterIndex = i;
				break;
			}
		}
		if (typeof thisChapterIndex !== 'undefined') {
			if (this.currentChapter !== chapters[thisChapterIndex]) {
				// this is a new chapter
				this.currentChapter = chapters[thisChapterIndex];
				if (this.useChapterTimes) {
					this.chapterDuration = this.getChapterDuration();
					this.seekIntervalCalculated = false; // will be recalculated in setSeekInterval()
				}
				if (typeof this.chaptersDiv !== 'undefined') {
					// chapters are listed in an external container
					var ul = this.chaptersDiv.querySelector('ul');
					if (ul) {
						var listItems = Array.from(ul.querySelectorAll('li'));
						listItems.forEach(function (li) {
							li.classList.remove('able-current-chapter');
							Array.from(li.children).forEach(function (child) {
								if (child.matches('button')) {
									child.removeAttribute('aria-current');
								}
							});
						});
						if (listItems[thisChapterIndex]) {
							listItems[thisChapterIndex].classList.add('able-current-chapter');
							Array.from(listItems[thisChapterIndex].children).forEach(function (child) {
								if (child.matches('button')) {
									child.setAttribute('aria-current', 'true');
								}
							});
						}
					}
				}
			}
		}
	};

	AblePlayer.prototype.getChapterDuration = function () {

		// called if this.seekbarScope === 'chapter'
		// get duration of the current chapter

		var lastChapterIndex, chapterEnd;

		if (typeof this.currentChapter === 'undefined') {
			return 0;
		}
		if (typeof this.duration === 'undefined') {
			return 0;
		}
		lastChapterIndex = this.selectedChapters.cues.length-1;
		if (this.selectedChapters.cues[lastChapterIndex] == this.currentChapter) {
			// this is the last chapter
			if (this.currentChapter.end !== this.duration) {
				// chapter ends before or after video ends, adjust chapter end to match video end
				chapterEnd = this.duration;
				this.currentChapter.end = this.duration;
			} else {
				chapterEnd = this.currentChapter.end;
			}
		} else { // this is not the last chapter
			chapterEnd = this.currentChapter.end;
		}
		return chapterEnd - this.currentChapter.start;
	};

	AblePlayer.prototype.getChapterElapsed = function () {
		// called if this.seekbarScope === 'chapter'
		// get current elapsed time, relative to the current chapter duration

		if (typeof this.currentChapter === 'undefined') {
			return 0;
		}

		if (this.elapsed > this.currentChapter.start) {
			return this.elapsed - this.currentChapter.start;
		} else {
			return 0;
		}
	};

	AblePlayer.prototype.convertChapterTimeToVideoTime = function (chapterTime) {

		// chapterTime is the time within the current chapter
		// return the same time, relative to the entire video
		if (typeof this.currentChapter !== 'undefined') {
			var newTime = this.currentChapter.start + chapterTime;
			if (newTime > this.currentChapter.end) {
				return this.currentChapter.end;
			} else {
				return newTime;
			}
		} else {
			return chapterTime;
		}
	};

	AblePlayer.prototype.getChapterClickFunction = function (time) {

		// Returns the function used when a chapter is clicked in the chapters menu.
		var thisObj = this;
		return function () {
			thisObj.seekTrigger = 'chapter';
			thisObj.seekTo(time);
			// stopgap to prevent spacebar in Firefox from reopening popup
			// immediately after closing it (used in handleChapters())
			thisObj.hidingPopup = true;
			thisObj.chaptersPopup.style.display = 'none';
			// Ensure stopgap gets cancelled if handleChapters() isn't called
			// e.g., if user triggered button with Enter or mouse click, not spacebar
			setTimeout(function() {
				thisObj.hidingPopup = false;
			}, 100);
			thisObj.chaptersButton.focus();
		}
	};

}

export default addChaptersFunctions;
