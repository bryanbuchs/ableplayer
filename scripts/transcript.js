function addTranscriptFunctions(AblePlayer) {
  AblePlayer.prototype.setupTranscript = function () {
    var deferred = new this.defer();
    var promise = deferred.promise();

    if (this.usingYouTubeCaptions || this.usingVimeoCaptions || this.hideTranscriptButton ) {
      // a transcript is not possible or is disabled.
      this.transcriptType = null;
      deferred.resolve();
    } else {
      if (!this.transcriptType) {
        // previously set transcriptType to null since there are no <track> elements
        // check again to see if captions have been collected from other sources (e.g., YouTube)

        if (this.captions.length) {
          // captions are possible! Use the default type (popup)
          // if other types ('external' and 'manual') were desired, transcriptType would not be null here
          this.transcriptType = "popup";
        }
      }
      if (this.transcriptType) {
        if ( this.transcriptType === "popup" || this.transcriptType === "external" ) {
          this.injectTranscriptArea();
          deferred.resolve();
        } else if (this.transcriptType === "manual") {
          this.setupManualTranscript();
          deferred.resolve();
        }
      } else {
        // there is no transcript
        deferred.resolve();
      }
    }
    return promise;
  };

  AblePlayer.prototype.injectTranscriptArea = function () {
    var autoScrollLabel,
      autoScrollContainer,
      languageSelectWrapper,
      languageSelectLabel,
      i,
      option;

    this.transcriptArea = this.createEl("div", {
      class: "able-transcript-area",
      role: "dialog",
      "aria-label": this.translate( 'transcriptTitle', 'Transcript' ),
    });

    this.transcriptToolbar = this.createEl("div", {
      class: "able-window-toolbar able-" + this.toolbarIconColor + "-controls",
    });

    this.transcriptDiv = this.createEl("div", {
      class: "able-transcript",
    });

    // Transcript toolbar content

    // Add auto Scroll checkbox
    this.autoScrollTranscriptCheckbox = this.createEl("input", {
      id: "autoscroll-transcript-checkbox-" + this.mediaId,
      type: "checkbox",
    });
    autoScrollLabel = this.createEl("label", {
      for: "autoscroll-transcript-checkbox-" + this.mediaId,
      text: this.translate( 'autoScroll', 'Auto scroll' ),
    });
	autoScrollContainer = this.createEl( 'div', {
		'class': 'autoscroll-transcript'
	});
	autoScrollContainer.append(
		autoScrollLabel,
		this.autoScrollTranscriptCheckbox
	);
    this.transcriptToolbar.append( autoScrollContainer );

    // Add field for selecting a transcript language
    // Only necessary if there is more than one language
    if (this.captions.length > 1) {
      languageSelectWrapper = this.createEl("div", {
        class: "transcript-language-select-wrapper",
      });
      languageSelectLabel = this.createEl("label", {
        for: "transcript-language-select-" + this.mediaId,
        text: this.translate( 'language', 'Language' ),
      });
      this.transcriptLanguageSelect = this.createEl("select", {
        id: "transcript-language-select-" + this.mediaId,
      });
      for (i = 0; i < this.captions.length; i++) {
        option = this.createEl("option", {
          value: this.captions[i]["language"],
          lang: this.captions[i]["language"],
          text: this.captions[i]["label"],
        });
        if (this.captions[i]["def"]) {
          option.selected = true;
        }
        this.transcriptLanguageSelect.append(option);
      }
    }
    if (languageSelectWrapper) {
      languageSelectWrapper.append(
        languageSelectLabel,
        this.transcriptLanguageSelect
      );
      this.transcriptToolbar.append(languageSelectWrapper);
    }
    this.transcriptArea.append(this.transcriptToolbar, this.transcriptDiv);

    // If client has provided separate transcript location, put it there.
    // Otherwise append it to the body
    if (this.transcriptDivLocation) {
	  this.transcriptArea.removeAttribute( 'role' );
	  this.transcriptArea.removeAttribute( 'aria-label' );
      document.getElementById(this.transcriptDivLocation).append(this.transcriptArea);
    } else {
      this.ableWrapper.append(this.transcriptArea);
    }

    // make it draggable (popup only; NOT external transcript)
    if (!this.transcriptDivLocation) {
      this.initDragDrop("transcript");
      if (this.prefTranscript === 1) {
        // transcript is on. Go ahead and position it
        this.positionDraggableWindow(
          "transcript",
          this.getDefaultWidth("transcript")
        );
      }
    }

    // If client has provided separate transcript location, override user's preference for hiding transcript
    if (!this.prefTranscript && !this.transcriptDivLocation) {
      this.transcriptArea.style.display = 'none';
    }
  };

  AblePlayer.prototype.addTranscriptAreaEvents = function () {
    var thisObj = this;

    this.autoScrollTranscriptCheckbox.addEventListener( 'click', function () {
      thisObj.handleTranscriptLockToggle(
        thisObj.autoScrollTranscriptCheckbox.checked
      );
    });

    var transcriptScrollHandler = function () {
      // Propagation is stopped in transcript click handler, so clicks are on the scrollbar
      // or outside of a clickable span.
      if (!thisObj.scrollingTranscript) {
        thisObj.autoScrollTranscript = false;
        thisObj.refreshControls("transcript");
      }
      thisObj.scrollingTranscript = false;
    };
    this.transcriptDiv.addEventListener("mousewheel", transcriptScrollHandler);
    this.transcriptDiv.addEventListener("DOMMouseScroll", transcriptScrollHandler);
    this.transcriptDiv.addEventListener("click", transcriptScrollHandler);
    this.transcriptDiv.addEventListener("scroll", transcriptScrollHandler);

    if (typeof this.transcriptLanguageSelect !== "undefined") {
      this.transcriptLanguageSelect.addEventListener('click', function (e) {
        // execute default behavior
        // prevent propagation of mouse event to toolbar or window
        e.stopPropagation();
      });

      this.transcriptLanguageSelect.addEventListener("change", function () {
        var language = thisObj.transcriptLanguageSelect.value;

        thisObj.syncTrackLanguages("transcript", language);
      });
    }
  };

  AblePlayer.prototype.transcriptSrcHasRequiredParts = function () {
    // check the external transcript to be sure it has all required components
    // return true or false
    // in the process, define all the needed variables and properties

    var transcriptArea = document.getElementById(this.transcriptSrc);
    if (transcriptArea) {
      this.transcriptArea = transcriptArea;
      var toolbar = this.transcriptArea.querySelector(".able-window-toolbar");
      if (toolbar) {
        this.transcriptToolbar = toolbar;
        var transcriptDiv = this.transcriptArea.querySelector(".able-transcript");
        if (transcriptDiv) {
          this.transcriptDiv = transcriptDiv;
          var seekpoints = Array.from(
            this.transcriptArea.querySelectorAll(".able-transcript-seekpoint")
          );
          if (seekpoints.length) {
            this.transcriptSeekpoints = seekpoints;
            return true;
          }
        }
      }
    }
    return false;
  };

  AblePlayer.prototype.setupManualTranscript = function () {
    var autoScrollInput, autoScrollLabel;

    autoScrollInput = this.createEl("input", {
      id: "autoscroll-transcript-checkbox-" + this.mediaId,
      type: "checkbox",
    });
    autoScrollLabel = this.createEl("label", {
      for: "autoscroll-transcript-checkbox-" + this.mediaId,
      text: this.translate( 'autoScroll', 'Auto scroll' ),
    });

    // Add an auto-scroll checkbox to the toolbar.
    this.autoScrollTranscriptCheckbox = autoScrollInput;
    this.transcriptToolbar.append(
      autoScrollLabel,
      this.autoScrollTranscriptCheckbox
    );
  };

  AblePlayer.prototype.updateTranscript = function () {
    if (!this.transcriptType) {
      return;
    }
    if (this.playerCreated && !this.transcriptArea) {
      return;
    }
    if (this.transcriptType === "external" || this.transcriptType === "popup") {
      var chapters, captions, descriptions;

      // Language of transcript might be different than language of captions
      // But both are in sync by default
      if (this.transcriptLang) {
        captions = this.transcriptCaptions.cues;
      } else {
        if (this.transcriptCaptions) {
          this.transcriptLang = this.transcriptCaptions.language;
          captions = this.transcriptCaptions.cues;
        } else if (this.selectedCaptions) {
          this.transcriptLang = this.captionLang;
          captions = this.selectedCaptions.cues;
        }
      }

      // setup chapters
      if (this.transcriptChapters) {
        chapters = this.transcriptChapters.cues;
      } else if (this.chapters.length > 0) {
        // Try and match the caption language.
        if (this.transcriptLang) {
          for (var i = 0; i < this.chapters.length; i++) {
            if (this.chapters[i].language === this.transcriptLang) {
              chapters = this.chapters[i].cues;
            }
          }
        }
        if (typeof chapters === "undefined") {
          chapters = this.chapters[0].cues || [];
        }
      }

      // setup descriptions
      if (this.transcriptDescriptions) {
        descriptions = this.transcriptDescriptions.cues;
      } else if (this.descriptions.length > 0) {
        // Try and match the caption language.
        if (this.transcriptLang) {
          for (i = 0; i < this.descriptions.length; i++) {
            if (this.descriptions[i].language === this.transcriptLang) {
              descriptions = this.descriptions[i].cues;
            }
          }
        }
        if (!descriptions) {
          descriptions = this.descriptions[0].cues || [];
        }
      }

      var div = this.generateTranscript(
        chapters || [],
        captions || [],
        descriptions || []
      );
      // replace transcript contents with the generated container node
      this.transcriptDiv.replaceChildren(div);
      // reset transcript selected <option> to this.transcriptLang
      if (this.transcriptLanguageSelect) {
        var selectedOption = this.transcriptLanguageSelect.querySelector("option:checked");
        if (selectedOption) {
          selectedOption.selected = false;
        }
        var langOption = this.transcriptLanguageSelect.querySelector(
          "option[lang=" + this.transcriptLang + "]"
        );
        if (langOption) {
          langOption.selected = true;
        }
      }
    }

    var thisObj = this;

    // Make transcript tabbable if preference is turned on.
    if (this.prefTabbable === 1) {
      this.transcriptDiv
        .querySelectorAll("span.able-transcript-seekpoint")
        .forEach(function (span) {
          span.setAttribute("tabindex", "0");
        });
    }

    // handle clicks on text within transcript
    // Note: This event listeners handles clicks only, not keydown events
    // Pressing Enter on an element that is not natively clickable does NOT trigger click()
    // Keydown events are handled elsehwere, both globally (ableplayer-base.js) and locally (event.js)
    if (this.transcriptArea) {
      this.transcriptArea
        .querySelectorAll("span.able-transcript-seekpoint")
        .forEach(function (span) {
          span.addEventListener( 'click', function () {
            thisObj.seekTrigger = "transcript";
            var spanStart = parseFloat(this.getAttribute("data-start"));
            // Add a tiny amount so that we're inside the span.
            spanStart += 0.01;
            // Each click within the transcript triggers two click events (not sure why)
            // this.seekingFromTranscript is a stopgab to prevent two calls to SeekTo()
            if (!thisObj.seekingFromTranscript) {
              thisObj.seekingFromTranscript = true;
              thisObj.seekTo(spanStart);
            } else {
              // don't seek a second time, but do reset var
              thisObj.seekingFromTranscript = false;
            }
          });
        });
    }
  };

  AblePlayer.prototype.highlightTranscript = function (currentTime) {
    // Show highlight in transcript marking current caption.

    if (!this.transcriptType) {
      return;
    }

    var start, end, isChapterHeading;
    var thisObj = this;

    currentTime = parseFloat(currentTime);

    // Highlight the current transcript item.
    var seekpoints = Array.from(
      this.transcriptArea.querySelectorAll("span.able-transcript-seekpoint")
    );
    for (var s = 0; s < seekpoints.length; s++) {
      var span = seekpoints[s];
      start = parseFloat(span.getAttribute("data-start"));
      end = parseFloat(span.getAttribute("data-end"));
      // be sure this isn't a chapter (don't highlight chapter headings)
      if (
        span.parentElement &&
        span.parentElement.classList.contains("able-transcript-chapter-heading")
      ) {
        isChapterHeading = true;
      } else {
        isChapterHeading = false;
      }

      if (currentTime >= start && currentTime <= end && !isChapterHeading) {
        // If this item isn't already highlighted, it should be
        if (!span.classList.contains("able-highlight")) {
          // remove all previous highlights before adding one to current span
          thisObj.transcriptArea
            .querySelectorAll(".able-highlight")
            .forEach(function (el) {
              el.classList.remove("able-highlight");
            });
          span.classList.add("able-highlight");
          thisObj.movingHighlight = true;
        }
        break;
      }
    }
    var highlighted = Array.from(
      thisObj.transcriptArea.querySelectorAll(".able-highlight")
    );
    if (highlighted.length === 0) {
      // Nothing highlighted.
      thisObj.currentHighlight = null;
    } else {
      thisObj.currentHighlight = highlighted;
    }
  };

  AblePlayer.prototype.generateTranscript = function (
    chapters,
    captions,
    descriptions
  ) {
    var thisObj = this;

    var main = this.createEl("div", { class: "able-transcript-container" });
    var transcriptTitle, firstStart;

    // set language for transcript container
    main.setAttribute("lang", this.transcriptLang);

    if (typeof this.transcriptTitle !== "undefined") {
      transcriptTitle = this.transcriptTitle;
    } else if (this.lyricsMode) {
      transcriptTitle = this.translate( 'lyricsTitle', 'Lyrics' );
    } else {
      transcriptTitle = this.translate( 'transcriptTitle', 'Transcript' );
    }

    if (!this.transcriptDivLocation) {
      // only add an HTML heading to internal transcript
      // external transcript is expected to have its own heading
      var headingNumber = this.playerHeadingLevel;
      headingNumber += 1;
      var chapterHeadingNumber = headingNumber + 1;

      let transcriptHeading;
      if (headingNumber <= 6) {
        transcriptHeading = "h" + headingNumber.toString();
      } else {
        transcriptHeading = "div";
      }
      var transcriptHeadingTag = this.createEl(transcriptHeading);
      transcriptHeadingTag.classList.add("able-transcript-heading");
      if (headingNumber > 6) {
        transcriptHeadingTag.setAttribute("role", "heading");
        transcriptHeadingTag.setAttribute("aria-level", headingNumber);
      }
      transcriptHeadingTag.textContent = transcriptTitle;

      // set language of transcript heading to language of player
      // this is independent of language of transcript
      transcriptHeadingTag.setAttribute("lang", this.lang);

      main.append(transcriptHeadingTag);
    }

    var nextChapter = 0;
    var nextCap = 0;
    var nextDesc = 0;

    var addChapter = function (div, chap) {
      let chapterHeading;
      if (chapterHeadingNumber <= 6) {
        chapterHeading = "h" + chapterHeadingNumber.toString();
      } else {
        chapterHeading = "div";
      }

      var chapterHeadingTag = thisObj.createEl(chapterHeading, {
        class: "able-transcript-chapter-heading",
      });
      if (chapterHeadingNumber > 6) {
        chapterHeadingTag.setAttribute("role", "heading");
        chapterHeadingTag.setAttribute("aria-level", chapterHeadingNumber);
      }

      var flattenComponentForChapter = function (comp) {
        var result = [];
        if (comp.type === "string") {
          result.push(comp.value);
        } else {
          for (var i = 0; i < comp.children.length; i++) {
            result = result.concat(
              flattenComponentForChapter(comp.children[i])
            );
          }
        }
        return result;
      };

      var chapSpan = thisObj.createEl("span", {
        class: "able-transcript-seekpoint",
      });
      for (var i = 0; i < chap.components.children.length; i++) {
        var results = flattenComponentForChapter(chap.components.children[i]);
        for (var jj = 0; jj < results.length; jj++) {
          chapSpan.append(results[jj]);
        }
      }
      chapSpan.setAttribute("data-start", chap.start.toString());
      chapSpan.setAttribute("data-end", chap.end.toString());
      chapterHeadingTag.append(chapSpan);

      div.append(chapterHeadingTag);
    };

    var addDescription = function (div, desc) {
      var descDiv = thisObj.createEl("div", {
        class: "able-transcript-desc",
      });
      var descHiddenSpan = thisObj.createEl("span", {
        class: "able-hidden",
      });
      descHiddenSpan.setAttribute("lang", thisObj.lang);
      descHiddenSpan.textContent = thisObj.translate( 'prefHeadingDescription', 'Audio description' ) + ": ";
      descDiv.append(descHiddenSpan);

      var flattenComponentForDescription = function (comp) {
        var result = [];
        if (comp.type === "string") {
          result.push(comp.value);
        } else {
          for (var i = 0; i < comp.children.length; i++) {
            result = result.concat(
              flattenComponentForDescription(comp.children[i])
            );
          }
        }
        return result;
      };

      var descSpan = thisObj.createEl("span", {
        class: "able-transcript-seekpoint",
      });
      for (var i = 0; i < desc.components.children.length; i++) {
        var results = flattenComponentForDescription(
          desc.components.children[i]
        );
        for (var jj = 0; jj < results.length; jj++) {
          descSpan.append(results[jj]);
        }
      }
      descSpan.setAttribute("data-start", desc.start.toString());
      descSpan.setAttribute("data-end", desc.end.toString());
      descDiv.append(descSpan);

      div.append(descDiv);
    };

    var addCaption = function (div, cap) {
      var capSpan = thisObj.createEl("span", {
        class: "able-transcript-seekpoint able-transcript-caption",
      });

      var flattenComponentForCaption = function (comp) {
        var result = [];

        var parts = 0;

        var flattenString = function (str) {
          parts++;

          var flatStr;
          var result = [];
          if (str === "") {
            return result;
          }

          var openBracket = str.indexOf("[");
          var closeBracket = str.indexOf("]");
          var openParen = str.indexOf("(");
          var closeParen = str.indexOf(")");

          var hasBrackets = openBracket !== -1 && closeBracket !== -1;
          var hasParens = openParen !== -1 && closeParen !== -1;

          if (hasParens || hasBrackets) {
            let silentSpanBreak;
            if (parts > 1) {
              // force a line break between sections that contain parens or brackets
              silentSpanBreak = "<br/>";
            } else {
              silentSpanBreak = "";
            }
            var silentSpanOpen =
              silentSpanBreak + '<span class="able-unspoken">';
            var silentSpanClose = "</span>";
            if (hasParens && hasBrackets) {
              // string has both!
              if (openBracket < openParen) {
                // brackets come first. Parse parens separately
                hasParens = false;
              } else {
                // parens come first. Parse brackets separately
                hasBrackets = false;
              }
            }
          }
          if (hasParens) {
            flatStr = str.substring(0, openParen);
            flatStr += silentSpanOpen;
            flatStr += str.substring(openParen, closeParen + 1);
            flatStr += silentSpanClose;
            flatStr += flattenString(str.substring(closeParen + 1));
            result.push(flatStr);
          } else if (hasBrackets) {
            flatStr = str.substring(0, openBracket);
            flatStr += silentSpanOpen;
            flatStr += str.substring(openBracket, closeBracket + 1);
            flatStr += silentSpanClose;
            flatStr += flattenString(str.substring(closeBracket + 1));
            result.push(flatStr);
          } else {
            result.push(str);
          }
          return result;
        };

        if (comp.type === "string") {
          result = result.concat(flattenString(comp.value));
        } else if (comp.type === "v") {
          var vSpan = thisObj.createEl("span", {
            class: "able-unspoken",
          });
          // don't display "title=" when rendering the voice tag title in the transcript
          comp.value = comp.value.replace(/^title="|"$/g, "");
          vSpan.textContent = "(" + comp.value + ")";
          result.push(vSpan);
          for (var i = 0; i < comp.children.length; i++) {
            let subResults = flattenComponentForCaption(comp.children[i]);
            for (let jj = 0; jj < subResults.length; jj++) {
              result.push(subResults[jj]);
            }
          }
        } else if (comp.type === "b" || comp.type === "i") {
          let tag;
          if (comp.type === "b") {
            tag = thisObj.createEl("strong");
          } else if (comp.type === "i") {
            tag = thisObj.createEl("em");
          }
          for (i = 0; i < comp.children.length; i++) {
            let subResults = flattenComponentForCaption(comp.children[i]);
            for (let jj = 0; jj < subResults.length; jj++) {
              tag.append(subResults[jj]);
            }
          }
          if (comp.type === "b" || comp.type == "i") {
            result.push(tag);
          }
        } else {
          for (i = 0; i < comp.children.length; i++) {
            result = result.concat(
              flattenComponentForCaption(comp.children[i])
            );
          }
        }
        return result;
      };

      for (var i = 0; i < cap.components.children.length; i++) {
		var next_child_tagname;
		if ( i < cap.components.children.length - 1 ) {
			next_child_tagname = cap.components.children[i + 1].tagName;
		}
        var results = flattenComponentForCaption(cap.components.children[i]);
        for (var jj = 0; jj < results.length; jj++) {
          var result = results[jj];
          if (typeof result === "string") {
           	if (thisObj.lyricsMode) {
				// add <br> WITHIN each caption (if payload includes "\n")
				result = result.replace(/\n/g,'<br>');

				// add <br> BETWEEN each caption, but do not consider sibling style tags within this caption as the next caption!
				if ( !next_child_tagname || ( next_child_tagname !== 'i' && next_child_tagname !== 'b' ) ) {
					result += '<br>';
				}
            } else {
              // just add a space between captions
              result += " ";
            }
            // string fragments may contain HTML markup (e.g., <br>, silent spans),
            // so insert as HTML to preserve prior jQuery .append(string) behavior
            capSpan.insertAdjacentHTML("beforeend", result);
          } else {
            capSpan.append(result);
          }
        }
      }
      capSpan.setAttribute("data-start", cap.start.toString());
      capSpan.setAttribute("data-end", cap.end.toString());
      div.append(capSpan);
      div.append(" \n");
    };

    // keep looping as long as any one of the three arrays has content
    while (
      nextChapter < chapters.length ||
      nextDesc < descriptions.length ||
      nextCap < captions.length
    ) {
      if (
        nextChapter < chapters.length &&
        nextDesc < descriptions.length &&
        nextCap < captions.length
      ) {
        // they all three have content
        firstStart = Math.min(
          chapters[nextChapter].start,
          descriptions[nextDesc].start,
          captions[nextCap].start
        );
      } else if (
        nextChapter < chapters.length &&
        nextDesc < descriptions.length
      ) {
        // chapters & descriptions have content
        firstStart = Math.min(
          chapters[nextChapter].start,
          descriptions[nextDesc].start
        );
      } else if (nextChapter < chapters.length && nextCap < captions.length) {
        // chapters & captions have content
        firstStart = Math.min(
          chapters[nextChapter].start,
          captions[nextCap].start
        );
      } else if (nextDesc < descriptions.length && nextCap < captions.length) {
        // descriptions & captions have content
        firstStart = Math.min(
          descriptions[nextDesc].start,
          captions[nextCap].start
        );
      } else {
        firstStart = null;
      }
      if (firstStart !== null) {
        if (
          typeof chapters[nextChapter] !== "undefined" &&
          chapters[nextChapter].start === firstStart
        ) {
          addChapter(main, chapters[nextChapter]);
          nextChapter += 1;
        } else if (
          typeof descriptions[nextDesc] !== "undefined" &&
          descriptions[nextDesc].start === firstStart
        ) {
          addDescription(main, descriptions[nextDesc]);
          nextDesc += 1;
        } else {
          addCaption(main, captions[nextCap]);
          nextCap += 1;
        }
      } else {
        if (nextChapter < chapters.length) {
          addChapter(main, chapters[nextChapter]);
          nextChapter += 1;
        } else if (nextDesc < descriptions.length) {
          addDescription(main, descriptions[nextDesc]);
          nextDesc += 1;
        } else if (nextCap < captions.length) {
          addCaption(main, captions[nextCap]);
          nextCap += 1;
        }
      }
    }
    // organize transcript into blocks using [] and () as starting points
    var components = Array.from(main.children);
    var spanCount = 0;
    components.forEach(function (component) {
      if (component.classList.contains("able-transcript-caption")) {
        if (
          component.textContent.indexOf("[") !== -1 ||
          component.textContent.indexOf("(") !== -1
        ) {
          // this caption includes a bracket or parenth. Start a new block
          // close the previous block first
          if (spanCount > 0) {
            main = wrapTranscriptBlocks( main );
            spanCount = 0;
          }
        }
        component.classList.add("able-block-temp");
        spanCount++;
      } else {
        // this is not a caption. Close the caption block
        if (spanCount > 0) {
          main = wrapTranscriptBlocks( main );
          spanCount = 0;
        }
      }
    });
	// Close out remaining temp blocks.
	main = wrapTranscriptBlocks( main );

    return main;
  };

  var wrapTranscriptBlocks = function( main ) {
	var tempEls = Array.from(main.querySelectorAll(".able-block-temp"));
	if (tempEls.length) {
		var block = document.createElement("div");
		block.className = "able-transcript-block";
		// insert the wrapper where the first temp element currently sits
		tempEls[0].before(block);
		tempEls.forEach(function (el) {
			el.classList.remove("able-block-temp");
			block.append(el);
		});
	}

	return main;
  }
}

export default addTranscriptFunctions;
