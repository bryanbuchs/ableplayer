import DOMPurify from 'dompurify';
import validate from './validate';
import AccessibleSlider from './slider';

function addBuildplayerFunctions(AblePlayer) {

	// Local helpers (replacements for jQuery's :visible filter and $.isEmptyObject)
	function isVisible(el) {
		return !!(el && (el.offsetParent !== null || el.getClientRects().length));
	}
	// Mimic jQuery .css(): append 'px' to bare numbers, leave strings untouched.
	function cssNum(val) {
		return (typeof val === 'number') ? val + 'px' : val;
	}
	function isEmptyObject(obj) {
		if (obj === null || typeof obj !== 'object') {
			return true;
		}
		for (var key in obj) {
			if (Object.hasOwn(obj, key)) {
				return false;
			}
		}
		return true;
	}

	AblePlayer.prototype.injectPlayerCode = function() {

		// create and inject surrounding HTML structure
		// If iOS & video:
		// iOS does not support any of the player's functionality - everything plays in its own player
		// Therefore, AblePlayer is not loaded & all functionality is disabled
		// (this all determined. If this is iOS && video, this function is never called)

		var captionsContainer;
		// Wrappers, from inner to outer:
		// mediaContainer - contains the original media element
		// ableDiv - contains the media player and all its objects (e.g., captions, controls, descriptions)
		// ableWrapper - contains additional widgets (e.g., transcript window, sign window)
		var mediaContainer = this.createEl('div', { 'class': 'able-media-container' });
		this.media.replaceWith(mediaContainer);
		mediaContainer.append(this.media);
		this.mediaContainer = mediaContainer;

		var ableDiv = this.createEl('div', { 'class': 'able' });
		this.mediaContainer.replaceWith(ableDiv);
		ableDiv.append(this.mediaContainer);
		this.ableDiv = ableDiv;

		var ableWrapper = this.createEl('div', { 'class': 'able-wrapper' });
		this.ableDiv.replaceWith(ableWrapper);
		ableWrapper.append(this.ableDiv);
		this.ableWrapper = ableWrapper;
		this.ableWrapper.classList.add('able-skin-' + this.skin);

		if (this.mediaType === 'video') {
			// youtube adds its own big play button
			// don't show ours *unless* video has a poster attribute
			// (which obstructs the YouTube poster & big play button)
			if (this.player !== 'youtube' || this.hasPoster) {
				this.injectBigPlayButton();
			}
		}

		// add container that captions or description will be appended to
		// Note: new element must be assigned _after_ wrap, hence the temp captionsContainer variable
		captionsContainer = this.createEl('div');
		if (this.mediaType === 'video') {
			captionsContainer.classList.add('able-vidcap-container');
		} else if (this.mediaType === 'audio') {
			captionsContainer.classList.add('able-audcap-container');
			// hide this by default. It will be shown if captions are available
			captionsContainer.classList.add('captions-off');
		}

		this.injectPlayerControlArea(); // this may need to be injected after captions???
		this.mediaContainer.replaceWith(captionsContainer);
		captionsContainer.append(this.mediaContainer);
		this.captionsContainer = captionsContainer;
		this.injectAlert(this.ableDiv);
		this.injectPlaylist();
		this.injectAudioPoster();
		// Do this last, as it should be prepended to the top of this.ableDiv
		// after everything else has prepended
		this.injectOffscreenHeading();
	};

	AblePlayer.prototype.injectAudioPoster = function() {
		if ( this.mediaType === 'audio' && this.hasPoster ) {
			const audioPoster = DOMPurify.sanitize(this.audioPoster);
			const audioPosterAlt = DOMPurify.sanitize(this.audioPosterAlt);
			let audioPosterImg = document.createElement( 'img' );
			audioPosterImg.setAttribute( 'src', audioPoster );
			audioPosterImg.setAttribute( 'alt', audioPosterAlt );
			var audioWrapper = this.createEl('div', { 'class': 'able-audio-wrapper' });
			this.playerDiv.replaceWith(audioWrapper);
			audioWrapper.append(this.playerDiv);
			this.audioWrapper = audioWrapper;
			this.audioWrapper.prepend( audioPosterImg );
		}
	}

	AblePlayer.prototype.injectOffscreenHeading = function () {

		// Inject an offscreen heading to the media container.
		// If heading hasn't already been manually defined via data-heading-level,
		// automatically assign a level that is one level deeper than the closest parent heading
		// as determined by getNextHeadingLevel()
		var headingType;
		if (this.playerHeadingLevel == '0') {
			// do NOT inject a heading (at author's request)
		} else {
			if (typeof this.playerHeadingLevel === 'undefined') {
				this.playerHeadingLevel = this.getNextHeadingLevel(this.ableDiv); // returns in integer 1-6
			}
			headingType = 'h' + this.playerHeadingLevel.toString();
			this.headingDiv = this.createEl(headingType);
			this.ableDiv.prepend(this.headingDiv);
			this.headingDiv.classList.add('able-offscreen');
			this.headingDiv.textContent = this.translate( 'playerHeading', 'Media player' );
		}
	};

	AblePlayer.prototype.injectBigPlayButton = function () {

		var thisObj = this;

		this.bigPlayButton = this.createEl('button', {
			'class': 'able-big-play-button',
			'aria-hidden': false,
			'aria-label': this.translate( 'play', 'Play' ),
			'type': 'button',
			'tabindex': 0
		});

		this.getIcon( this.bigPlayButton, 'play' );

		this.bigPlayButton.addEventListener( 'click', function () {
			thisObj.handlePlay();
		});

		this.mediaContainer.append(this.bigPlayButton);
	};

	AblePlayer.prototype.injectPlayerControlArea = function () {

		this.playerDiv = this.createEl('div', {
			'class' : 'able-player',
			'role' : 'region',
			'aria-label' : ( 'audio' === this.mediaType ) ? this.translate( 'audioPlayer', 'audio player' ) : this.translate( 'videoPlayer', 'video player' )
		});
		this.playerDiv.classList.add('able-' + this.mediaType);
		if (this.hasPlaylist && this.showNowPlaying) {
			this.nowPlayingDiv = this.createEl('div', {
				'class' : 'able-now-playing',
				'aria-live' : 'assertive',
				'aria-atomic': 'true'
			});
		}
		this.controllerDiv = this.createEl('div', {
			'class' : 'able-controller'
		});
		this.controllerDiv.classList.add('able-' + this.iconColor + '-controls');

		this.statusBarDiv = this.createEl('div', {
			'class' : 'able-status-bar'
		});
		this.timer = this.createEl('span', {
			'class' : 'able-timer'
		});
		this.elapsedTimeContainer = this.createEl('span', {
			'class': 'able-elapsedTime',
			text: '0:00'
		});
		this.durationContainer = this.createEl('span', {
			'class': 'able-duration'
		});
		this.durationSeparator = this.createEl('span', {
			'class': 'able-timer-separator',
			'text': ' / '
		});
		this.timer.append(this.elapsedTimeContainer);
		this.timer.append(this.durationSeparator);
		this.timer.append(this.durationContainer);

		this.speed = this.createEl('span', {
			'class' : 'able-speed',
			'aria-live' : 'assertive',
			'aria-atomic' : 'true',
			text: this.translate( 'speed', 'Speed' ) + ': 1x'
		});

		this.status = this.createEl('span', {
			'class' : 'able-status',
			'aria-live' : 'polite'
		});

		// Put everything together.
		this.statusBarDiv.append(this.timer, this.speed, this.status);
		if (this.showNowPlaying) {
			this.playerDiv.append(this.nowPlayingDiv, this.controllerDiv, this.statusBarDiv);
		} else {
			this.playerDiv.append(this.controllerDiv, this.statusBarDiv);
		}

		if (this.mediaType === 'video') {
			// the player controls go after the media & captions
			this.ableDiv.append(this.playerDiv);
		} else {
			// the player controls go before the media & captions
			this.ableDiv.prepend(this.playerDiv);
		}
	};

	AblePlayer.prototype.injectTextDescriptionArea = function () {

		// create a div for writing description text
		this.descDiv = this.createEl('div', {
			'class': 'able-descriptions'
		});
		// Add ARIA so description will be announced by screen readers
		// Later (in description.js > showDescription()),
		// if browser supports Web Speech API and this.descMethod === 'browser'
		// these attributes will be removed
		this.descDiv.setAttribute('aria-live', 'assertive');
		this.descDiv.setAttribute('aria-atomic', 'true');
		// Start off with description hidden.
		// It will be exposed conditionally within description.js > initDescription()
		this.descDiv.style.display = 'none';
		this.ableDiv.append(this.descDiv);
	};

	AblePlayer.prototype.getDefaultWidth = function(which) {
		let viewportMaxwidth = window.innerWidth;
		// return default width of resizable elements
		// these values are somewhat arbitrary, but seem to result in good usability
		// if users disagree, they can resize (and resposition) them
		if (which === 'transcript') {
			return ( viewportMaxwidth <= 450 ) ? viewportMaxwidth : 450;
		} else if (which === 'sign') {
			return ( viewportMaxwidth <= 400 ) ? viewportMaxwidth : 400;
		}
	};

	/**
	 * Reposition draggable windows when switched into fullscreen.
	 *
	 * @param {string} which 'transcript' or 'sign'.
	 */
	AblePlayer.prototype.rePositionDraggableWindow = function (which) {

		let preferences, win;
		preferences = this.getPref();
		win = ( which === 'transcript' ) ? this.transcriptArea : this.signWindow;
		console.log( win );
		if ( which === 'transcript' && win ) {
			if (typeof preferences.transcript !== 'undefined') {
				this.prevTranscriptPosition = preferences.transcript;
			}
			win.style.top = '0';
			win.style.left = '0';
		} else if ( 'sign' === which && win ) {
			if (typeof preferences.sign !== 'undefined') {
				this.prevSignPosition = preferences.sign;
			}
			win.style.top = '0';
			win.style.right = '0';
			win.style.left = 'auto';
		}
	}

	AblePlayer.prototype.positionDraggableWindow = function (which, width) {

		// which is either 'transcript' or 'sign'
		var preferences, preferencePos, win, windowPos, viewportWidth, windowWidth;

		preferences = this.getPref();
		win = ( which === 'transcript' ) ? this.transcriptArea : this.signWindow;
		if ( ! win ) {
			return;
		}
		if (which === 'transcript') {
			if (typeof preferences.transcript !== 'undefined') {
				preferencePos = preferences.transcript;
			}
			if ( this.prevTranscriptPosition ) {
				preferencePos = this.prevTranscriptPosition;
				this.prevTranscriptPosition = false;
			}
		} else if (which === 'sign') {
			if (typeof preferences.sign !== 'undefined') {
				preferencePos = preferences.sign;
			}
			if ( this.prevSignPosition ) {
				preferencePos = this.prevSignPosition;
				this.prevSignPosition = false;
			}
		}
		if (typeof preferencePos !== 'undefined' && !(isEmptyObject(preferencePos))) {
			// position window using stored values from preferences
			win.style.position = preferencePos['position'];
			win.style.width = cssNum(preferencePos['width']);
			win.style.zIndex = preferencePos['zindex'];
			if (preferencePos['position'] === 'absolute') {
				win.style.top = cssNum(preferencePos['top']);
				win.style.left = cssNum(preferencePos['left']);
				// Check whether the window is above the top of the viewport.
				let winRect = win.getBoundingClientRect();
				let topPosition = winRect.top + window.scrollY;
				let leftPosition = winRect.left + window.scrollX;
				viewportWidth = window.innerWidth;
				windowWidth = win.getBoundingClientRect().width;
				if ( topPosition < 0 ) {
					win.style.top = cssNum(preferencePos['top'] - topPosition);
				}
				// If draggable window is off screen to the left.
				if ( leftPosition < 0 && ! this.restoringAfterFullscreen ) {
					console.log( leftPosition );
					win.style.left = cssNum(preferencePos['left'] - leftPosition);
				}
				// If draggable window is off screen to the right.
				if ( viewportWidth - leftPosition < 30 ) {
					win.style.left = cssNum(viewportWidth - windowWidth);
				}
			}
			// since preferences are not page-specific, z-index needs may vary across different pages
			this.updateZIndex(which);
		} else {
			// position window using default values
			windowPos = this.getOptimumPosition(which, width);
			if (typeof width === 'undefined') {
				width = this.getDefaultWidth(which);
			}
			win.style.position = windowPos[0];
			win.style.width = cssNum(width);
			win.style.zIndex = windowPos[3];
			if (windowPos[0] === 'absolute') {
				win.style.top = windowPos[1] + 'px';
				win.style.left = windowPos[2] + 'px';
			}
		}
	};

	AblePlayer.prototype.getOptimumPosition = function (targetWindow, targetWidth) {

		// returns optimum position for targetWindow, as an array with the following structure:
		// 0 - CSS position ('absolute' or 'relative')
		// 1 - top
		// 2 - left
		// 3 - zindex (if not default)
		// targetWindow is either 'transcript' or 'sign'
		// if there is room to the right of the player, position element there
		// else if there is room the left of the player, position element there
		// else position element beneath player

		var gap, position, ableWidth, ableOffset, ableLeft, windowWidth, otherWindowWidth;

		if (typeof targetWidth === 'undefined') {
			targetWidth = this.getDefaultWidth(targetWindow);
		}

		gap = 5; // number of pixels to preserve between Able Player objects
		position = []; // position, top, left

		var ableRect = this.ableDiv.getBoundingClientRect();
		ableWidth = ableRect.width;
		ableOffset = { top: ableRect.top + window.scrollY, left: ableRect.left + window.scrollX };
		ableLeft = ableOffset.left;
		windowWidth = window.innerWidth;
		otherWindowWidth = 0; // width of other visiable draggable windows will be added to this

		if (targetWindow === 'transcript') {
			// If placing the transcript window, check position of sign window first.
			if (typeof this.signWindow !== 'undefined' && this.signWindow && isVisible(this.signWindow)) {
				otherWindowWidth = this.signWindow.getBoundingClientRect().width + gap;
			}
		} else if (targetWindow === 'sign') {
			// If placing the sign window, check position of transcript window first.
			if (typeof this.transcriptArea !== 'undefined' && this.transcriptArea && isVisible(this.transcriptArea)) {
				otherWindowWidth = this.transcriptArea.getBoundingClientRect().width + gap;
			}
		}
		if (targetWidth < (windowWidth - (ableLeft + ableWidth + gap + otherWindowWidth))) {
			// there's room to the left of ableDiv
			position[0] = 'absolute';
			position[1] = 0;
			position[2] = ableWidth + otherWindowWidth + gap;
		} else if (targetWidth + gap < ableLeft) {
			// there's room to the right of ableDiv
			position[0] = 'absolute';
			position[1] = 0;
			position[2] = ableLeft - targetWidth - gap;
		} else {
			// position element below ableDiv
			position[0] = 'relative';
			// no need to define top, left, or z-index
		}
		return position;
	};

	AblePlayer.prototype.injectAlert = function (container) {
		// inject two alerts, one visible for all users and one for screen reader users only
		this.alertBox = this.createEl('div', { 'role': 'alert' });
		this.alertBox.classList.add('able-alert');
		this.alertBox.style.display = 'none';

		var alertText = this.createEl('span');
		this.alertBox.append(alertText);

		var alertDismiss = this.createEl('button', { 'type': 'button' });
		alertDismiss.setAttribute( 'aria-label', this.translate( 'dismissButton', 'Dismiss' ) );
		alertDismiss.textContent = '×';
		this.alertBox.append(alertDismiss);

		alertDismiss.addEventListener( 'click', function() {
			var parentDiv = this.closest('div');
			if (parentDiv) {
				parentDiv.style.display = 'none';
			}
		});

		container.append(this.alertBox);

		if ( ! this.srAlertBox ) {
			this.srAlertBox = this.createEl('div', { 'role': 'alert' });
			this.srAlertBox.classList.add('able-screenreader-alert');
			container.append(this.srAlertBox);
		}
	};

	AblePlayer.prototype.injectPlaylist = function () {

		if (this.playlistEmbed === true) {
			// move playlist into player, immediately before statusBarDiv
			var playlistClone = this.playlistDom.cloneNode(true);
			this.statusBarDiv.before(playlistClone);
			// Update to the new playlist copy.
			this.playlist = Array.from(playlistClone.querySelectorAll('li'));
		}
	};

	AblePlayer.prototype.createPopup = function (which, tracks) {

		// Create popup menu and append to player
		// 'which' parameter is either 'captions', 'chapters', 'prefs', 'transcript-window' or 'sign-window'
		// 'tracks', if provided, is a list of tracks to be used as menu items

		var thisObj, menu, includeMenuItem, i, menuItem, prefCat, whichPref, hasDefault, track,
		windowOptions, hasDescription, hasTranscript;

		thisObj = this;

		menu = this.createEl('ul', {
			'id': this.mediaId + '-' + which + '-menu',
			'class': 'able-popup',
			'role': 'menu'
		});
		menu.style.display = 'none';

		if (which === 'captions') {
			menu.classList.add('able-popup-captions');
		}

		// Populate menu with menu items
		if (which === 'prefs') {
			if (this.prefCats.length > 1) {
				for (i = 0; i < this.prefCats.length; i++) {
					prefCat = this.prefCats[i];
					hasDescription = ( thisObj.hasDescTracks || thisObj.hasOpenDesc || thisObj.hasClosedDesc ) ? true : false;
					hasTranscript  = ( thisObj.transcriptType === null ) ? false : true;

					// If this player does not have descriptions or transcripts, do not output that option preferences.
					if ( prefCat === 'descriptions' && ! hasDescription || prefCat === 'transcript' && ! hasTranscript ) {
						continue;
					}
					menuItem = this.createEl('li', {
						'role': 'menuitem',
						'tabindex': '-1'
					});
					if (prefCat === 'captions') {
						menuItem.textContent = this.translate( 'prefMenuCaptions', 'Captions' );
					} else if (prefCat === 'descriptions') {
						menuItem.textContent = this.translate( 'prefMenuDescriptions', 'Descriptions' );
					} else if (prefCat === 'keyboard') {
						menuItem.textContent = this.translate( 'prefMenuKeyboard', 'Keyboard' );
					} else if (prefCat === 'transcript') {
						menuItem.textContent = this.translate( 'prefMenuTranscript', 'Transcript' );
					}
					menuItem.addEventListener('click', function() {
						whichPref = this.textContent;
						thisObj.showingPrefsDialog = true;
						thisObj.setFullscreen(false);
						if (whichPref === thisObj.translate( 'prefMenuCaptions', 'Captions' ) ) {
							thisObj.captionPrefsDialog.show();
						} else if (whichPref === thisObj.translate( 'prefMenuDescriptions', 'Descriptions' ) ) {
							thisObj.descPrefsDialog.show();
						} else if (whichPref === thisObj.translate( 'prefMenuKeyboard', 'Keyboard' ) ) {
							thisObj.keyboardPrefsDialog.show();
						} else if (whichPref === thisObj.translate( 'prefMenuTranscript', 'Transcript' ) ) {
							thisObj.transcriptPrefsDialog.show();
						}
						thisObj.closePopups();
						thisObj.showingPrefsDialog = false;
					});
					menu.append(menuItem);
				}
				this.prefsButton.setAttribute('data-prefs-popup', 'menu');
			} else if (this.prefCats.length == 1) {
				// only 1 category, so don't create a popup menu.
				// Instead, open dialog directly when user clicks Prefs button
				this.prefsButton.setAttribute('data-prefs-popup', this.prefCats[0]);
			}
		} else if (which === 'captions' || which === 'chapters') {
			hasDefault = false;
			for (i = 0; i < tracks.length; i++) {
				track = tracks[i];
				if (which === 'captions' && this.player === 'html5' && typeof track.cues === 'undefined') {
					includeMenuItem = false;
				} else {
					includeMenuItem = true;
				}
				if (includeMenuItem) {
					menuItem = this.createEl('li', {
						'role': 'menuitemradio',
						'tabindex': '-1',
						'lang': track.language
					});
					if (track.def && this.prefCaptions == 1) {
						menuItem.setAttribute('aria-checked', 'true');
						hasDefault = true;
					} else {
						menuItem.setAttribute('aria-checked', 'false');
					}
					// Get a label using track data
					if (which == 'captions') {
						menuItem.textContent = track.label;
						menuItem.addEventListener('click', this.getCaptionClickFunction(track));
					} else if (which == 'chapters') {
						menuItem.textContent = this.flattenCueForCaption(track) + ' - ' + this.formatSecondsAsColonTime(track.start);
						menuItem.addEventListener('click', this.getChapterClickFunction(track.start));
					}
					menu.append(menuItem);
				}
			}
			if (which === 'captions') {
				// add a 'captions off' menu item
				menuItem = this.createEl('li', {
					'role': 'menuitemradio',
					'tabindex': '-1',
					text: this.translate( 'captionsOff', 'Captions off' )
				});
				if (this.prefCaptions === 0) {
					menuItem.setAttribute('aria-checked', 'true');
					hasDefault = true;
				} else {
					menuItem.setAttribute('aria-checked', 'false');
				}
				menuItem.addEventListener('click', this.getCaptionOffFunction());
				menu.append(menuItem);
			}
		} else if (which === 'transcript-window' || which === 'sign-window') {
			windowOptions = [];
			windowOptions.push({
				'name': 'move',
				'label': this.translate( 'windowMove', 'Move' )
			});
			windowOptions.push({
				'name': 'resize',
				'label': this.translate( 'windowResize', 'Resize' )
			});
			windowOptions.push({
				'name': 'close',
				'label': this.translate( 'closeButtonLabel', 'Close' )
			});
			for (i = 0; i < windowOptions.length; i++) {
				menuItem = this.createEl('li', {
					'role': 'menuitem',
					'tabindex': '-1',
					'data-choice': windowOptions[i].name
				});
				menuItem.textContent = windowOptions[i].label;
				menuItem.addEventListener('click', function(e) {
					e.stopPropagation();
					if (typeof e.button !== 'undefined' && e.button !== 0) {
						// this was a mouse click (if click is triggered by keyboard, e.button is undefined)
						// and the button was not a left click (left click = 0)
						// therefore, ignore this click
						return false;
					}
					if (!thisObj.windowMenuClickRegistered && !thisObj.finishingDrag) {
						thisObj.windowMenuClickRegistered = true;
						thisObj.handleMenuChoice(which.substring(0, which.indexOf('-')), this.getAttribute('data-choice'), e);
					}
				});
				menu.append(menuItem);
			}
		}
		// assign default item, if there isn't one already
		if (which === 'captions' && !hasDefault) {
			// check the menu item associated with the default language
			// as determined in control.js > syncTrackLanguages()
			var langItem = menu.querySelector('li[lang=' + this.captionLang + ']');
			if (langItem) {
				// a track exists for the default language. Check that item in the menu
				langItem.setAttribute('aria-checked', 'true');
			} else {
				// check the last item (captions off)
				var lastItem = menu.querySelectorAll('li');
				if (lastItem.length) {
					lastItem[lastItem.length - 1].setAttribute('aria-checked', 'true');
				}
			}
		} else if (which === 'chapters') {
			var chapterItems = Array.from(menu.querySelectorAll('li'));
			var matchedChapter = chapterItems.filter(function(li) {
				return li.textContent.indexOf(thisObj.defaultChapter) !== -1;
			});
			if (matchedChapter.length) {
				matchedChapter.forEach(function(li) {
					li.setAttribute('aria-checked', 'true');
					li.classList.add('able-focus');
				});
			} else if (chapterItems.length) {
				chapterItems[0].setAttribute('aria-checked', 'true');
				chapterItems[0].classList.add('able-focus');
			}
		}
		// add keyboard handlers for navigating within popups
		menu.addEventListener('keydown', function (e) {

			var items = Array.from(this.querySelectorAll('li'));
			var thisItem = this.querySelector('li:focus');
			var thisIndex = items.indexOf(thisItem);
			var prevItem, nextItem;
			if (thisIndex === 0) {
				// this is the first item in the menu
				prevItem = items[items.length - 1]; // wrap to bottom
				nextItem = items[thisIndex + 1];
			} else if (thisIndex === items.length - 1) {
				// this is the last Item
				prevItem = items[thisIndex - 1];
				nextItem = items[0]; // wrap to top
			} else {
				prevItem = items[thisIndex - 1];
				nextItem = items[thisIndex + 1];
			}
			if (e.key === 'Tab') {
				if (e.shiftKey) {
					if (thisItem) { thisItem.classList.remove('able-focus'); }
					if (prevItem) { prevItem.focus(); prevItem.classList.add('able-focus'); }
				} else {
					if (thisItem) { thisItem.classList.remove('able-focus'); }
					if (nextItem) { nextItem.focus(); nextItem.classList.add('able-focus'); }
				}
			} else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
				if (thisItem) { thisItem.classList.remove('able-focus'); }
				if (nextItem) { nextItem.focus(); nextItem.classList.add('able-focus'); }
			} else if (e.key == 'ArrowUp' || e.key === 'ArrowLeft') {
				if (thisItem) { thisItem.classList.remove('able-focus'); }
				if (prevItem) { prevItem.focus(); prevItem.classList.add('able-focus'); }
			} else if (e.key === ' ' || e.key === 'Enter') {
				if (thisItem) { thisItem.click(); }
			} else if (e.key === 'Escape') {
				if (thisItem) { thisItem.classList.remove('able-focus'); }
				thisObj.closePopups();
				e.stopPropagation;
			}
			e.preventDefault();
		});
		this.controllerDiv.append(menu);
		return menu;
	};

	AblePlayer.prototype.closePopups = function () {

		var thisObj = this;

		if (this.chaptersPopup && isVisible(this.chaptersPopup)) {
			this.chaptersPopup.style.display = 'none';
			this.chaptersButton.setAttribute('aria-expanded', 'false');
			this.chaptersButton.focus();
		}
		if (this.captionsPopup && isVisible(this.captionsPopup)) {
			this.captionsPopup.style.display = 'none';
			this.ccButton.setAttribute('aria-expanded', 'false');
			this.waitThenFocus(this.ccButton);
		}
		if (this.prefsPopup && isVisible(this.prefsPopup) && !this.hidingPopup) {
			this.hidingPopup = true; // stopgap to prevent popup from re-opening again on keypress
			this.prefsPopup.style.display = 'none';
			// restore menu items to their original state
			this.prefsPopup.querySelectorAll('li').forEach(function(li) {
				li.classList.remove('able-focus');
				li.setAttribute('tabindex', '-1');
			});
			this.prefsButton.setAttribute('aria-expanded', 'false');
			if (!this.showingPrefsDialog) {
				this.waitThenFocus(thisObj.prefsButton);
			}
			// wait briefly, then reset hidingPopup
			setTimeout(function() {
				thisObj.hidingPopup = false;
			}, 100);
		}
		if (this.volumeSlider && isVisible(this.volumeSlider)) {
			this.volumeSlider.style.display = 'none';
			this.volumeSlider.setAttribute('aria-hidden', 'true');
			this.volumeButton.setAttribute('aria-expanded', 'false');
			this.volumeButton.focus();
		}
		if (this.transcriptPopup && isVisible(this.transcriptPopup)) {
			this.hidingPopup = true;
			this.transcriptPopup.style.display = 'none';
			// restore menu items to their original state
			this.transcriptPopup.querySelectorAll('li').forEach(function(li) {
				li.classList.remove('able-focus');
				li.setAttribute('tabindex', '-1');
			});
			this.transcriptPopupButton.setAttribute('aria-expanded', 'false');
			this.transcriptPopupButton.focus();
			// wait briefly, then reset hidingPopup
			setTimeout(function() {
				thisObj.hidingPopup = false;
			}, 100);
		}
		if (this.signPopup && isVisible(this.signPopup)) {
			this.signPopup.style.display = 'none';
			// restore menu items to their original state
			this.signPopup.querySelectorAll('li').forEach(function(li) {
				li.classList.remove('able-focus');
				li.setAttribute('tabindex', '-1');
			});
			this.signPopupButton.setAttribute('aria-expanded', 'false');
			this.signPopupButton.focus();
		}
	};

	AblePlayer.prototype.setupPopups = function (which) {

		// Create and fill in the popup menu forms for various controls.
		// parameter 'which' is passed if refreshing content of an existing popup ('captions' or 'chapters')
		// If which is undefined, automatically setup 'captions', 'chapters', and 'prefs' popups
		// However, only setup 'transcript-window' and 'sign-window' popups if passed as value of which
		var popups, i, tracks;

		popups = [];
		if (typeof which === 'undefined') {
			popups.push('prefs');
		}

		if (which === 'captions' || (typeof which === 'undefined')) {
			if (this.captions.length > 0) {
				popups.push('captions');
			}
		}
		if (which === 'chapters' || (typeof which === 'undefined')) {
			if (this.chapters.length > 0 && this.useChaptersButton) {
				popups.push('chapters');
			}
		}
		if (which === 'transcript-window' && this.transcriptType === 'popup') {
			popups.push('transcript-window');
		}
		if (which === 'sign-window' && this.hasSignLanguage) {
			popups.push('sign-window');
		}
		if (popups.length > 0) {
			for (i=0; i<popups.length; i++) {
				var popup = popups[i];
				if (popup == 'prefs') {
					this.prefsPopup = this.createPopup('prefs');
				} else if (popup == 'captions') {
					if (typeof this.captionsPopup === 'undefined' || !this.captionsPopup) {
						this.captionsPopup = this.createPopup('captions',this.captions);
					}
				} else if (popup == 'chapters') {
					if (this.selectedChapters) {
						tracks = this.selectedChapters.cues;
					} else if (this.chapters.length >= 1) {
						tracks = this.chapters[0].cues;
					} else {
						tracks = [];
					}
					if (typeof this.chaptersPopup === 'undefined' || !this.chaptersPopup) {
						this.chaptersPopup = this.createPopup('chapters',tracks);
					}
				} else if (popup == 'transcript-window') {
					return this.createPopup('transcript-window');
				} else if (popup == 'sign-window') {
					return this.createPopup('sign-window');
				}
			}
		}
	};

	AblePlayer.prototype.provideFallback = function() {

		// provide fallback in case of a critical error building the player
		// to test, set data-test-fallback to either of the following values:
		// 1 = emulate failure to build Able Player
		// 2 = emulate browser that doesn't support HTML5 media

		var i, fallback;

		if (this.usingFallback) {
			// fallback has already been implemented.
			// stopgap to prevent this function from executing twice on the same media element
			return;
		} else {
			this.usingFallback = true;
		}

		if (!this.testFallback) {
			// this is not a test.
			// an actual error has resulted in this function being called.
			// use scenario 1
			this.testFallback = 1;
		}

		// this.media is the native media element; it should already exist by this point

		// get/assign an id for the media element
		if (this.media.getAttribute('id')) {
			this.mediaId = this.media.getAttribute('id');
		} else {
			this.mediaId = 'media' + Math.floor(Math.random() * 1000000000).toString();
		}

		// check whether element has nested fallback content
		this.hasFallback = false;
		if (this.media.children.length) {
			i = 0;
			while (i < this.media.children.length && !this.hasFallback) {
				if (!(this.media.children[i].tagName === 'SOURCE' ||
					this.media.children[i].tagName === 'TRACK')) {
					// this element is something other than <source> or <track>
					this.hasFallback = true;
				}
				i++;
			}
		}
		if (!this.hasFallback) {
			// the HTML code does not include any nested fallback content
			// inject our own
			// NOTE: this message is not translated, since fallback may be needed
			// due to an error loading the translation file
			// This will only be needed on very rare occasions, so English is ok.
			fallback = this.createEl('p', { text: 'Media player unavailable.' });
			this.media.append(fallback);
		}

		// get height and width attributes, if present
		// and add them to a style attribute
		if (this.media.getAttribute('width')) {
			this.media.style.width = this.media.getAttribute('width') + 'px';
		}
		if (this.media.getAttribute('height')) {
			this.media.style.height = this.media.getAttribute('height') + 'px';
		}
		// Remove data-able-player attribute
		this.media.removeAttribute('data-able-player');

		// Add controls attribute (so browser will add its own controls)
		this.media.controls = true;

		if (this.testFallback == 2) {

			// emulate browser failure to support HTML5 media by changing the media tag name
			// browsers should display the supported content that's nested inside
			var foobar = this.createEl('foobar', { 'id': 'foobar-' + this.mediaId });
			this.media.replaceWith(foobar);
			this.newFallbackElement = AblePlayer.localGetElementById(foobar, 'foobar-' + this.mediaId) || document.getElementById('foobar-' + this.mediaId);

			// append all children from the original media
			if (this.media.children.length) {
				i = this.media.children.length - 1;
				while (i >= 0) {
					this.newFallbackElement.prepend(this.media.children[i]);
					i--;
				}
			}
			if (!this.hasFallback) {
				// inject our own fallback content, defined above
				this.newFallbackElement.append(fallback);
			}
		} else {
			console.warn("Able Player encountered a problem, falling back to browser's HTML5 player.");
		}
		return;
	};

	AblePlayer.prototype.calculateControlLayout = function () {

		// Calculates the layout for controls based on media and options.
		// Returns an array with 4 keys (for legacy skin) or 2 keys (for 2020 skin)
		// Keys are the following order:
		// 0 = Top left
		// 1 = Top right
		// 2 = Bottom left (legacy skin only)
		// 3 = Bottom right (legacy skin only)
		// Each key contains an array of control names to put in that section.

		var controlLayout, playbackSupported, numA11yButtons;

		controlLayout = [];
		controlLayout[0] = [];
		controlLayout[1] = [];
		if (this.skin === 'legacy') {
			controlLayout[2] = [];
			controlLayout[3] = [];
		}

		controlLayout[0].push('play');
		controlLayout[0].push('restart');
		controlLayout[0].push('rewind');
		controlLayout[0].push('forward');

		if (this.skin === 'legacy') {
			controlLayout[1].push('seek');
		}

		if (this.hasPlaylist) {
			if (this.skin === 'legacy') {
				controlLayout[0].push('previous');
				controlLayout[0].push('next');
			} else {
				controlLayout[0].push('previous');
				controlLayout[0].push('next');
			}
		}

		if (this.isPlaybackRateSupported()) {
			playbackSupported = true;
			if (this.skin === 'legacy') {
				controlLayout[2].push('slower');
				controlLayout[2].push('faster');
			}
		} else {
			playbackSupported = false;
		}

		numA11yButtons = 0;
		if (this.hasCaptions) {
			numA11yButtons++;
			if (this.skin === 'legacy') {
				controlLayout[2].push('captions');
			} else {
				controlLayout[1].push('captions');
			}
		}
		if (this.hasSignLanguage) {
			numA11yButtons++;
			if (this.skin === 'legacy') {
				controlLayout[2].push('sign');
			} else {
				controlLayout[1].push('sign');
			}
		}
		if (this.mediaType === 'video') {
			if (this.hasOpenDesc || this.hasClosedDesc) {
				numA11yButtons++;
				if (this.skin === 'legacy') {
					controlLayout[2].push('descriptions');
				} else {
					controlLayout[1].push('descriptions');
				}
			}
		}
		if (this.transcriptType !== null && !(this.hideTranscriptButton)) {
			numA11yButtons++;
			if (this.skin === 'legacy') {
				controlLayout[2].push('transcript');
			} else {
				controlLayout[1].push('transcript');
			}
		}
		if (this.hasChapters && this.useChaptersButton) {
			numA11yButtons++;
			if (this.skin === 'legacy') {
				controlLayout[2].push('chapters');
			} else {
				controlLayout[1].push('chapters');
			}
		}

		if (this.skin == '2020' && numA11yButtons > 0) {
			controlLayout[1].push('pipe');
		}

		if (playbackSupported && this.skin === '2020') {
			controlLayout[1].push('faster');
			controlLayout[1].push('slower');
			controlLayout[1].push('pipe');
		}

		if (this.skin === 'legacy') {
			controlLayout[3].push('preferences');
		} else {
			controlLayout[1].push('preferences');
		}

		if (this.mediaType === 'video' && this.allowFullscreen && this.nativeFullscreenSupported() ) {
			if (this.skin === 'legacy') {
				controlLayout[3].push('fullscreen');
			} else {
				controlLayout[1].push('fullscreen');
			}
		}

		if (this.browserSupportsVolume()) {
			this.volumeButton = 'volume-' + this.getVolumeName(this.volume);
			if (this.skin === 'legacy') {
				controlLayout[1].push('volume');
			} else {
				controlLayout[1].push('volume');
			}
		} else {
			this.volume = false;
		}
		return controlLayout;
	};

	AblePlayer.prototype.addControls = function() {

		// determine which controls to show based on several factors:
		// mediaType (audio vs video)
		// availability of tracks (e.g., for closed captions & audio description)
		// browser support (e.g., for sliders and speedButtons)
		// user preferences (???)
		// some controls are aligned on the left, and others on the right

		var thisObj, controlLayout, numSections,
		i, j, controls, controllerSpan, sliderDiv, sliderLabel, pipe, control,
		buttonTitle, newButton, buttonText, position, buttonHeight,
		buttonWidth, buttonSide, controllerWidth, tooltipId, tooltipY, tooltipX,
		tooltipWidth, tooltipStyle, tooltip, tooltipTimerId, captionLabel, popupMenuId;

		thisObj = this;

		// Initialize the layout into the this.controlLayout variable.
		controlLayout = this.calculateControlLayout();
		numSections = controlLayout.length;

		// add an empty div to serve as a tooltip
		tooltipId = this.mediaId + '-tooltip';
		this.tooltipDiv = this.createEl('div', {
			'id': tooltipId,
			'class': 'able-tooltip'
		});
		this.tooltipDiv.style.display = 'none';
		this.controllerDiv.append(this.tooltipDiv);

		if (this.skin == '2020') {
			// add a full-width seek bar
			sliderDiv = this.createEl('div', { 'class': 'able-seekbar' });
			sliderLabel = this.mediaType + ' ' + this.translate( 'seekbarLabel', 'timeline' );
			this.controllerDiv.append(sliderDiv);
			this.seekBar = new AccessibleSlider(sliderDiv, this.duration, this.seekInterval, sliderLabel );
		}

		// add a full-width seek bar
		let controlRow = this.createEl('div', { 'class': 'able-control-row' });
		this.controllerDiv.append(controlRow);

		for (i = 0; i < numSections; i++) {
			controls = controlLayout[i];
			if ((i % 2) === 0) { // even keys on the left
				controllerSpan = this.createEl('div', {
					'class': 'able-left-controls'
				});
			} else { // odd keys on the right
				controllerSpan = this.createEl('div', {
					'class': 'able-right-controls'
				});
			}
			controlRow.append(controllerSpan);

			for (j=0; j<controls.length; j++) {
				control = controls[j];
				if (control === 'seek') {
					sliderDiv = this.createEl('div', { 'class': 'able-seekbar' });
					sliderLabel = this.mediaType + ' ' + this.translate( 'seekbarLabel', 'timeline' );
					controllerSpan.append(sliderDiv);
					if (typeof this.duration === 'undefined' || this.duration === 0) {
						// set arbitrary starting duration, and change it when duration is known
						this.duration = 60;
						// also set elapsed to 0
						this.elapsed = 0;
					}
					this.seekBar = new AccessibleSlider( sliderDiv, this.duration, this.seekInterval, sliderLabel );
				} else if (control === 'pipe') {
					pipe = this.createEl('span', {
						'aria-hidden': 'true',
						'class': 'able-pipe'
					});
					pipe.append('|');
					controllerSpan.append(pipe);
				} else {
					// this control is a button
					buttonTitle = this.getButtonTitle(control);

					// Buttons consist of a <div role="button"> with an <svg> inside.
					// We add aria-label to the button (but not title)
					// This has been thoroughly tested and works well in all screen reader/browser combinations
					// See https://github.com/ableplayer/ableplayer/issues/81

					// NOTE: Changed from <button> to <div role="button" as of 4.2.18
					// because <button> elements are rendered poorly in high contrast mode
					// in some OS/browser/plugin combinations

					// In 5.0.0, icons are always SVG, so the font & image icon edge cases are removed.
					newButton = this.createEl('div', {
						'role': 'button',
						'tabindex': '0',
						'class': 'able-button-handler-' + control
					});

					if (control === 'volume' || control === 'preferences' || control === 'captions') {
						if (control == 'preferences') {
							this.prefCats = this.getPreferencesGroups();
							if (this.prefCats.length > 1) {
								// Prefs button will trigger a menu
								popupMenuId = this.mediaId + '-prefs-menu';
								newButton.setAttribute('aria-controls', popupMenuId);
								newButton.setAttribute('aria-haspopup', 'menu');
								newButton.setAttribute('aria-expanded', 'false');
							} else if (this.prefCats.length === 1) {
								// Prefs button will trigger a dialog
								newButton.setAttribute('aria-haspopup', 'dialog');
							}
						} else if (control === 'volume') {
							popupMenuId = this.mediaId + '-volume-slider';
							// volume slider popup is not a menu or a dialog
							// therefore, using aria-expanded rather than aria-haspopup to communicate properties/state
							newButton.setAttribute('aria-controls', popupMenuId);
							newButton.setAttribute('aria-expanded', 'false');
						} else if (control === 'captions' && this.captions) {
							if (this.captions.length > 1) {
								newButton.setAttribute('aria-expanded', 'false');
							} else {
								newButton.setAttribute('aria-pressed', 'false');
							}
						}
					}
					var getControl = control;
					if ( control === 'faster' && this.speedIcons === 'animals' ) {
						getControl = 'rabbit';
					}
					if ( control === 'slower' && this.speedIcons === 'animals' ) {
						getControl = 'turtle';
					}
					if ( control === 'volume' ) {
						this.getIcon( newButton, this.volumeButton );
					} else {
						if ( 'fullscreen' === getControl ) {
							getControl = ( this.fullscreen ) ? 'fullscreen-collapse' : 'fullscreen-expand';
						}
						this.getIcon( newButton, getControl );
					}

					this.setText(newButton, buttonTitle);
					// add an event listener that displays a tooltip on mouseenter or focus
					var tooltipShow = function(e) {

						// when entering a new tooltip, we can forget about hiding the previous tooltip.
						// since the same tooltip div is used, it's location just changes.
						clearTimeout(tooltipTimerId);

						buttonText = this.getAttribute('aria-label');
						// get position of this button
						position = { top: this.offsetTop, left: this.offsetLeft };
						buttonHeight = this.getBoundingClientRect().height;
						buttonWidth = this.getBoundingClientRect().width;
						// position() is expressed using top and left (of button);
						// add right (of button) too, for convenience
						controllerWidth = thisObj.controllerDiv.getBoundingClientRect().width;
						position.right = controllerWidth - position.left - buttonWidth;

						// The following formula positions tooltip below the button
						// which allows the tooltip to be hoverable as per WCAG 2.x SC 1.4.13
						// without obstructing the seekbar
						tooltipY = position.top + buttonHeight + 5;

						if (this.parentElement.classList.contains('able-right-controls')) {
							// this control is on the right side
							buttonSide = 'right';
						} else {
							// this control is on the left side
							buttonSide = 'left';
						}
						// populate tooltip, then calculate its width before showing it
						var tooltipEl = AblePlayer.localGetElementById(newButton, tooltipId);
						tooltipEl.textContent = buttonText;
						tooltipWidth = tooltipEl.getBoundingClientRect().width;
						// center the tooltip horizontally over the button
						if (buttonSide == 'left') {
							tooltipX = position.left - tooltipWidth/2;
							if (tooltipX < 0) {
								// tooltip would exceed the bounds of the player. Adjust.
								tooltipX = 2;
							}
							tooltipStyle = {
								left: tooltipX + 'px',
								right: '',
								top: tooltipY + 'px'
							};
						} else {
							tooltipX = position.right - tooltipWidth/2;
							if (tooltipX < 0) {
								// tooltip would exceed the bounds of the player. Adjust.
								tooltipX = 2;
							}
							tooltipStyle = {
								left: '',
								right: tooltipX + 'px',
								top: tooltipY + 'px'
							};
						}
						tooltip = AblePlayer.localGetElementById(newButton, tooltipId);
						tooltip.textContent = buttonText;
						tooltip.style.left = tooltipStyle.left;
						tooltip.style.right = tooltipStyle.right;
						tooltip.style.top = tooltipStyle.top;
						thisObj.showTooltip(tooltip);

						var tooltipHide = function() {

							// (keep the tooltip visible if user hovers over it)
							// This causes unwanted side effects if tooltips are positioned above the buttons
							// as the persistent tooltip obstructs the seekbar,
							// blocking users from being able to move a pointer from a button to the seekbar
							// This limitation was addressed in 4.4.49 by moving the tooltip below the buttons

							// clear existing timeout before reassigning variable
							clearTimeout(tooltipTimerId);
							tooltipTimerId = setTimeout(function() {
								// give the user a half second to move cursor to tooltip before removing
								// see https://www.w3.org/WAI/WCAG21/Understanding/content-on-hover-or-focus#hoverable
								var tEl = AblePlayer.localGetElementById(newButton, tooltipId);
								tEl.textContent = '';
								tEl.style.display = 'none';
							}, 500);

							thisObj.tooltipDiv.addEventListener('mouseenter', function() {
								clearTimeout(tooltipTimerId);
							});
							thisObj.tooltipDiv.addEventListener('focus', function() {
								clearTimeout(tooltipTimerId);
							});

							thisObj.tooltipDiv.addEventListener('mouseleave', function() {
								var tEl = AblePlayer.localGetElementById(newButton, tooltipId);
								tEl.textContent = '';
								tEl.style.display = 'none';
							});
							thisObj.tooltipDiv.addEventListener('blur', function() {
								var tEl = AblePlayer.localGetElementById(newButton, tooltipId);
								tEl.textContent = '';
								tEl.style.display = 'none';
							});

						};
						this.addEventListener('mouseleave', tooltipHide);
						this.addEventListener('blur', tooltipHide);
					};
					newButton.addEventListener('mouseenter', tooltipShow);
					newButton.addEventListener('focus', tooltipShow);

					if (control === 'captions') {
						if (!this.prefCaptions || this.prefCaptions !== 1) {
							// captions are available, but user has them turned off
							if (this.captions.length > 1) {
								captionLabel = this.translate( 'captions', 'Captions' );
							} else {
								captionLabel = this.translate( 'showCaptions', 'Show captions' );
							}
							newButton.classList.add('buttonOff');
							newButton.setAttribute('title', captionLabel);
							newButton.setAttribute('aria-pressed', 'false');
						}
					} else if (control === 'descriptions') {
						if (!this.prefDesc || this.prefDesc !== 1) {
							// user prefer non-audio described version
							// Therefore, load media without description
							// Description can be toggled on later with this button
							newButton.classList.add('buttonOff');
							newButton.setAttribute('title', this.translate( 'turnOnDescriptions', 'Turn on descriptions' ));
						}
					}

					controllerSpan.append(newButton);

					// create variables of buttons that are referenced throughout the AblePlayer object
					if (control === 'play') {
						this.playpauseButton = newButton;
					} else if (control == 'previous') {
						this.prevButton = newButton;
						// if player is being rebuilt because user clicked the Prev button
						// return focus to that (newly built) button
						if (this.buttonWithFocus == 'previous') {
							this.prevButton.focus();
							this.buttonWithFocus = null;
						}
					} else if (control == 'next') {
						this.nextButton = newButton;
						// if player is being rebuilt because user clicked the Next button
						// return focus to that (newly built) button
						if (this.buttonWithFocus == 'next') {
							this.nextButton.focus();
							this.buttonWithFocus = null;
						}
					} else if (control === 'captions') {
						this.ccButton = newButton;
					} else if (control === 'sign') {
						this.signButton = newButton;
						// gray out sign button if sign language window is not active
						if (!(isVisible(this.signWindow))) {
							this.signButton.classList.add('buttonOff');
						}
					} else if (control === 'descriptions') {
						this.descButton = newButton;
						// button will be enabled or disabled in description.js > initDescription()
					} else if (control === 'mute') {
						this.muteButton = newButton;
					} else if (control === 'transcript') {
						this.transcriptButton = newButton;
						// gray out transcript button if transcript is not active
						if (!(isVisible(this.transcriptDiv))) {
							this.transcriptButton.classList.add('buttonOff');
							this.transcriptButton.setAttribute('title', this.translate( 'showTranscript', 'Show transcript' ));
						}
					} else if (control === 'fullscreen') {
						this.fullscreenButton = newButton;
					} else if (control === 'chapters') {
						this.chaptersButton = newButton;
					} else if (control === 'preferences') {
						this.prefsButton = newButton;
					} else if (control === 'volume') {
						this.volumeButton = newButton;
					}
				}
				if (control === 'volume') {
					// in addition to the volume button, add a hidden slider
					this.addVolumeSlider(controllerSpan);
				}
			}
			if ((i % 2) == 1) {
				var clearDiv = this.createEl('div', { 'class': 'ableplayer-clear' });
				this.controllerDiv.append(clearDiv);
			}
		}

		if (typeof this.captionsDiv !== 'undefined') {
			// stylize captions based on user prefs
			this.stylizeCaptions(this.captionsDiv);
		}
		if (typeof this.descDiv !== 'undefined') {
			// stylize descriptions based on user's caption prefs
			this.stylizeCaptions(this.descDiv);
		}

		// combine left and right controls arrays for future reference
		this.controls = [];
		for (var sec in controlLayout) if (Object.hasOwn(controlLayout, sec)) {
			this.controls = this.controls.concat(controlLayout[sec]);
		}

		// Update state-based display of controls.
		this.refreshControls();
	};

	AblePlayer.prototype.cuePlaylistItem = function(sourceIndex) {

		// Move to a new item in a playlist.
		// NOTE: Swapping source for audio description is handled elsewhere;
		// see description.js > swapDescription()

		var newItem, prevPlayer, newPlayer, itemTitle, itemLang, nowPlayingSpan;

		var thisObj = this;

		prevPlayer = this.player;

		if (this.initializing) { // this is the first track - user hasn't pressed play yet
			// do nothing.
		} else {
			if (this.playerCreated) {
				// remove the old
				this.deletePlayer('playlist');
			}
		}

		// set swappingSrc; needs to be true within recreatePlayer(), called below
		this.swappingSrc = true;

		// if a new playlist item is being requested, and playback has already started,
		// it should be ok to play automatically, regardless of how it was requested
		if (this.startedPlaying) {
			this.okToPlay = true;
		} else {
			this.okToPlay = false;
		}

		// We are no longer loading the previous media source
		// Only now, as a new source is requested, is it safe to reset this var
		// It will be reset to true when media.load() is called
		this.loadingMedia = false;

		// Determine appropriate player to play this media
		newItem = this.playlist[sourceIndex];
		this.playlistIndex = sourceIndex;
		if (this.hasAttr(newItem,'data-youtube-id')) {
			this.youTubeId = this.getYouTubeId(newItem.getAttribute('data-youtube-id'));
			if (this.hasAttr(newItem,'data-youtube-desc-id')) {
				this.youTubeDescId = this.getYouTubeId(newItem.getAttribute('data-youtube-desc-id'));
			}
			newPlayer = 'youtube';
		} else if (this.hasAttr(newItem,'data-vimeo-id')) {
			this.vimeoId = this.getVimeoId(newItem.getAttribute('data-vimeo-id'));
			if (this.hasAttr(newItem,'data-vimeo-desc-id')) {
				this.vimeoDescId = this.getVimeoId(newItem.getAttribute('data-vimeo-desc-id'));
			}
			newPlayer = 'vimeo';
		} else {
			newPlayer = 'html5';
		}
		if (newPlayer === 'youtube') {
			if (prevPlayer === 'html5') {
				// pause and hide the previous media
				if (this.playing) {
					this.pauseMedia();
				}
				this.media.style.display = 'none';
			}
		} else {
			// the new player is not youtube
			this.youTubeId = false;
			if (prevPlayer === 'youtube') {
				// unhide the media element
				this.media.style.display = '';
			}
		}
		this.player = newPlayer;

		// remove source and track elements from previous playlist item
		this.media.replaceChildren();

		// transfer media attributes from playlist to media element
		if (this.hasAttr(newItem,'data-poster')) {
			this.media.setAttribute('poster', newItem.getAttribute('data-poster'));
		}
		if (this.hasAttr(newItem,'data-youtube-desc-id')) {
			this.media.setAttribute('data-youtube-desc-id', newItem.getAttribute('data-youtube-desc-id'));
		}
		if (this.youTubeId) {
			this.media.setAttribute('data-youtube-id', newItem.getAttribute('data-youtube-id'));
		}

		// add new <source> elements from playlist data
		var sourceSpans = Array.from(newItem.children).filter(function(el) {
			return el.matches('span.able-source');
		});
		if (sourceSpans.length) {
			sourceSpans.forEach(function(spanEl) {

				// Check if the required data-src attribute exists
				if (thisObj.hasAttr(spanEl, "data-src")) {
					const sanitizedSrc = DOMPurify.sanitize(spanEl.getAttribute("data-src"));

					// Validate the protocol of the sanitized URL
					if (validate.isProtocolSafe(sanitizedSrc)) {
						// Create a new <source> element with the sanitized src
						const newSource = thisObj.createEl("source", { src: sanitizedSrc });

						// List of optional attributes to sanitize and add
						const optionalAttributes = [
							"data-type",
							"data-desc-src",
							"data-sign-src",
						];

						// Process optional attributes
						optionalAttributes.forEach((attr) => {
							if (thisObj.hasAttr(spanEl, attr)) {
								const attrValue = spanEl.getAttribute(attr); // Get the attribute value
								const sanitizedValue = DOMPurify.sanitize(attrValue); // Sanitize the value

								// If the attribute ends with "-src", validate the protocol
								if (attr.endsWith("-src") && validate.isProtocolSafe(sanitizedValue)) {
									newSource.setAttribute(attr, sanitizedValue); // Add the sanitized and validated attribute
								} else if (!attr.endsWith("-src")) {
									newSource.setAttribute(attr, sanitizedValue); // Add sanitized value for non-src attributes
								}
							}
						});

						// Append the new <source> element to the media object
						thisObj.media.append(newSource);
					}
				}
			});
		}

		// add new <track> elements from playlist data
		var trackSpans = Array.from(newItem.children).filter(function(el) {
			return el.matches('span.able-track');
		});
		if (trackSpans.length) {
			 // for each element in trackSpans, create a new <track> element
			trackSpans.forEach(function(spanEl) {
				if (thisObj.hasAttr(spanEl, "data-src") && thisObj.hasAttr(spanEl, "data-kind") && thisObj.hasAttr(spanEl, "data-srclang")) {
					// all required attributes are present
					const sanitizedSrc = DOMPurify.sanitize(spanEl.getAttribute("data-src"));
					// Validate the protocol of the sanitized URL
					if (validate.isProtocolSafe(sanitizedSrc)) {
						// Create a new <track> element with the sanitized src
						const newTrack = thisObj.createEl("track", {
							src: sanitizedSrc,
							kind: spanEl.getAttribute("data-kind"),
							srclang: spanEl.getAttribute("data-srclang"),
						});
						// List of optional attributes to sanitize and add
						const optionalAttributes = [
							"data-label",
							"data-desc",
							"data-default",
						];
						optionalAttributes.forEach((attr) => {
							if (thisObj.hasAttr(spanEl, attr)) {
								newTrack.setAttribute(attr, DOMPurify.sanitize(spanEl.getAttribute(attr)));
							}
						});
						// Append the new <track> element to the media object
						thisObj.media.append(newTrack);
					}
				}
			});
		}

		itemTitle = DOMPurify.sanitize( newItem.textContent );
		if (this.hasAttr(newItem,'lang')) {
			itemLang = newItem.getAttribute('lang');
		}
		// Update relevant arrays
		this.sources = Array.from(this.media.querySelectorAll('source'));

		// recreate player, informed by new attributes and track elements
		if (this.recreatingPlayer) {
			// stopgap to prevent multiple firings of recreatePlayer()
			return;
		}
		this.recreatePlayer().then(function() {

			// update playlist to indicate which item is playing
			thisObj.playlist.forEach(function(li) {
				li.classList.remove('able-current');
				Array.from(li.children).forEach(function(child) {
					if (child.matches('button')) {
						child.removeAttribute('aria-current');
					}
				});
			});
			var currentItem = thisObj.playlist[sourceIndex];
			if (currentItem) {
				currentItem.classList.add('able-current');
				Array.from(currentItem.children).forEach(function(child) {
					if (child.matches('button')) {
						child.setAttribute('aria-current', 'true');
					}
				});
			}

			// update Now Playing div
			if (thisObj.showNowPlaying === true) {
				if (typeof thisObj.nowPlayingDiv !== 'undefined') {
					nowPlayingSpan = thisObj.createEl('span');
					if (typeof itemLang !== 'undefined') {
						nowPlayingSpan.setAttribute('lang', itemLang);
					}
					nowPlayingSpan.innerHTML = '<span>' + thisObj.translate( 'selectedTrack', 'Selected Track' ) + ':</span>' + itemTitle;
					thisObj.nowPlayingDiv.replaceChildren();
					thisObj.nowPlayingDiv.append(nowPlayingSpan);
				}
			}

			// if thisObj.swappingSrc is true, media will autoplay when ready
			if (thisObj.initializing) { // this is the first track - user hasn't pressed play yet
				thisObj.swappingSrc = false;
			} else {
				if (thisObj.player === 'html5') {
					if (!thisObj.loadingMedia) {
						thisObj.media.load();
						thisObj.loadingMedia = true;
					}
				} else if (thisObj.player === 'youtube') {
					thisObj.okToPlay = true;
				}
			}
			thisObj.initializing = false;
			thisObj.playerCreated = true; // remains true until browser is refreshed
		});
	};

	AblePlayer.prototype.deletePlayer = function(context) {

		// remove player components that need to be rebuilt
		// after swapping media sources that have different durations
		// or explicitly declared data-desc attributes

		// Context is one of the following:
		// playlist - called from cuePlaylistItem()
		// swap-desc-html - called from swapDescription with this.player == 'html'
		// swap-desc-youtube - called from swapDescription with this.player == 'youtube'
		// swap-desc-vimeo -  called from swapDescription with this.player == 'vimeo'

		if (this.player === 'youtube' && this.youTubePlayer) {
			this.youTubePlayer.destroy();
		}

		if (this.player === 'vimeo' && this.vimeoPlayer) {
			this.vimeoPlayer.destroy();
		}

		// Empty elements that will be rebuilt
		this.controllerDiv.replaceChildren();
		// this.statusBarDiv.replaceChildren();
		// this.timer.replaceChildren();
		this.elapsedTimeContainer.replaceChildren();
		this.elapsedTimeContainer.textContent = '0:00'; // span.able-elapsedTime
		this.durationContainer.replaceChildren(); // span.able-duration

		// Remove popup windows and modal dialogs; these too will be rebuilt
		if (this.signWindow) {
				this.signWindow.remove();
		}
		if (this.transcriptArea) {
				this.transcriptArea.remove();
		}
		document.querySelectorAll('.able-modal-dialog').forEach(function(el) {
			el.remove();
		});

		// Remove caption and description wrappers
		if (this.captionsWrapper) {
			this.captionsWrapper.remove();
		}
		if (this.descDiv) {
			this.descDiv.remove();
		}

		// reset key variables
		this.hasCaptions = false;
		this.hasChapters = false;
		this.hasDescTracks = false;
		this.hasOpenDesc = false;
		this.hasClosedDesc = false;

		this.captionsPopup = null;
		this.chaptersPopup = null;
		this.transcriptType = null;

		this.playerDeleted = true; // will reset to false in recreatePlayer()
	};

	AblePlayer.prototype.getButtonTitle = function(control) {

		if (control === 'playpause') {
			return this.translate( 'play', 'Play' );
		} else if (control === 'play') {
			return this.translate( 'play', 'Play' );
		} else if (control === 'pause') {
			return this.translate( 'pause', 'Pause' );
		} else if (control === 'restart') {
			return this.translate( 'restart', 'Restart' );
		} else if (control === 'previous') {
			return this.translate( 'prevTrack', 'Previous track' );
		} else if (control === 'next') {
			return this.translate( 'nextTrack', 'Next track' );
		} else if (control === 'rewind') {
			return this.translate( 'rewind', 'Rewind' );
		} else if (control === 'forward') {
			return this.translate( 'forward', 'Forward' );
		} else if (control === 'captions') {
			if (this.captions.length > 1) {
				return this.translate( 'captions', 'Captions' );
			} else {
				return (this.captionsOn) ? this.translate( 'hideCaptions', 'Hide captions' ) : this.translate( 'showCaptions', 'Show captions' );
			}
		} else if (control === 'descriptions') {
			return (this.descOn) ? this.translate( 'turnOffDescriptions', 'Turn off descriptions' ) : this.translate( 'turnOnDescriptions', 'Turn on descriptions' );
		} else if (control === 'transcript') {
			return (isVisible(this.transcriptDiv)) ? this.translate( 'hideTranscript', 'Hide transcript' ) : this.translate( 'showTranscript', 'Show transcript' );
		} else if (control === 'chapters') {
			return this.translate( 'chapters', 'Chapters' );
		} else if (control === 'sign') {
			return this.translate( 'sign', 'Sign language' );
		} else if (control === 'volume') {
			return this.translate( 'volume', 'Volume' );
		} else if (control === 'faster') {
			return this.translate( 'faster', 'Faster' );
		} else if (control === 'slower') {
			return this.translate( 'slower', 'Slower' );
		} else if (control === 'preferences') {
			return this.translate( 'preferences', 'Preferences' );
		} else if (control === 'fullscreen') {
			return ( !this.fullscreen ) ? this.translate( 'enterFullScreen', 'Enter full screen' ) : this.translate( 'exitFullScreen', 'Exit full screen' );
		} else {
			// there should be no other controls, but just in case:
			// return the name of the control with first letter in upper case
			// ultimately will need to get a translated label from this.tt
			if (this.debug) {
				console.log('Found an untranslated label: ' + control);
			}
			return this.capitalizeFirstLetter( control );
		}
	};
}

export default addBuildplayerFunctions;
