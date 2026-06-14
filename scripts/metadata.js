function addMetadataFunctions(AblePlayer) {
  AblePlayer.prototype.updateMeta = function (time) {
    if (this.hasMeta) {
      if (this.metaType === "text") {
        this.metaDivEl.style.display = '';
        this.showMeta(time || this.elapsed);
      } else {
        this.showMeta(time || this.elapsed);
      }
    }
  };

  AblePlayer.prototype.showMeta = function (now) {
    var tempSelectors,
      m,
      thisMeta,
      cues,
      cueText,
      cueLines,
      i,
      line,
      showDuration,
      focusTarget;

    tempSelectors = [];
    if (this.meta.length >= 1) {
      cues = this.meta;
    } else {
      cues = [];
    }
    for (m = 0; m < cues.length; m++) {
      if (cues[m].start <= now && cues[m].end > now) {
        thisMeta = m;
        break;
      }
    }
    if (typeof thisMeta !== "undefined") {
      if (this.currentMeta !== thisMeta) {
        if (this.metaType === "text") {
          // it's time to load the new metadata cue into the container div
          this.metaDivEl.innerHTML =
            this.flattenCueForMeta(cues[thisMeta]).replace(/\n/g, "<br>");
        } else if (this.metaType === "selector") {
          // it's time to show content referenced by the designated selector(s)
          cueText = this.flattenCueForMeta(cues[thisMeta]);
          cueLines = cueText.split("\n");
          for (i = 0; i < cueLines.length; i++) {
            line = cueLines[i].trim();
            if (line.toLowerCase().trim() === "pause") {
              // don't show big play button when pausing via metadata
              this.hideBigPlayButton = true;
              this.pauseMedia();
            } else if (line.toLowerCase().substring(0, 6) == "focus:") {
              focusTarget = line.substring(6).trim();
              if (document.querySelector(focusTarget)) {
                document.querySelector(focusTarget).focus();
              }
            } else {
              if (document.querySelector(line)) {
                // selector exists
                this.currentMeta = thisMeta;
                showDuration = parseInt(document.querySelector(line).getAttribute("data-duration"));
                if (
                  typeof showDuration !== "undefined" &&
                  !isNaN(showDuration)
                ) {
					this.showMetaSelector(line);
					const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
					delay(showDuration).then(() => {
						this.hideMetaSelector(line);
					});
                } else {
                  // no duration specified. Just show the element until end time specified in VTT file
                  this.showMetaSelector(line);
                }
                // add to array of visible selectors so it can be hidden at end time
                this.visibleSelectors.push(line);
                tempSelectors.push(line);
              }
            }
          }
          // now step through this.visibleSelectors and remove anything that's stale
          if (this.visibleSelectors && this.visibleSelectors.length) {
            if (this.visibleSelectors.length !== tempSelectors.length) {
              for (i = this.visibleSelectors.length - 1; i >= 0; i--) {
                if (tempSelectors.indexOf(this.visibleSelectors[i]) == -1) {
                  this.hideMetaSelector(this.visibleSelectors[i]);
                  this.visibleSelectors.splice(i, 1);
                }
              }
            }
          }
        }
      }
    } else {
      // there is currently no metadata. Empty stale content
      if (typeof this.metaDivEl !== "undefined" && this.metaDivEl !== null) {
        this.metaDivEl.innerHTML = "";
      }
      if (this.visibleSelectors && this.visibleSelectors.length) {
        for (i = 0; i < this.visibleSelectors.length; i++) {
          this.hideMetaSelector(this.visibleSelectors[i]);
        }
        // reset array
        this.visibleSelectors = [];
      }
      this.currentMeta = -1;
    }
  };

  // Show/hide all elements matching an author-supplied CSS selector.
  // (jQuery's .show()/.hide() operated on every matching element.)
  AblePlayer.prototype.showMetaSelector = function (selector) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.style.display = '';
    });
  };

  AblePlayer.prototype.hideMetaSelector = function (selector) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.style.display = 'none';
    });
  };

  // Takes a cue and returns the metadata text to display for it.
  AblePlayer.prototype.flattenCueForMeta = function (cue) {
    var result = [];

    var flattenComponent = function (component) {
      var result = [],
        ii;
      if (component.type === "string") {
        result.push(component.value);
      } else if (component.type === "v") {
        result.push("[" + component.value + "]");
        for (ii = 0; ii < component.children.length; ii++) {
          result.push(flattenComponent(component.children[ii]));
        }
      } else {
        for (ii = 0; ii < component.children.length; ii++) {
          result.push(flattenComponent(component.children[ii]));
        }
      }
      return result.join("");
    };

    for (var ii = 0; ii < cue.components.children.length; ii++) {
      result.push(flattenComponent(cue.components.children[ii]));
    }

    return result.join("");
  };
}

export default addMetadataFunctions;
