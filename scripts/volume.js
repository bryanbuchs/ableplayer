function addVolumeFunctions(AblePlayer) {

	AblePlayer.prototype.addVolumeSlider = function(div) {

		// Prior to v4.4.64, we were using a custom-build vertical volunme slider
		// Changed to input type="range" because it's standard and gaining more widespread support
		// including screen reader support
		// TODO: Improve presentation of vertical slider. That requires some CSS finesse.

		var thisObj, volumeSliderId, volumeHelpId, volumePct, volumeLabel, volumeHeight;

		thisObj = this;

		// define a few variables
		volumeSliderId = this.mediaId + '-volume-slider';
		volumeHelpId = this.mediaId + '-volume-help';

		this.volumeSlider = this.createEl('div', {
			'id': volumeSliderId,
			'class': 'able-volume-slider',
			'aria-hidden': 'true'
		});
		this.volumeSlider.style.display = 'none';
		this.volumeSliderTooltip = this.createEl('div', {
			'class': 'able-tooltip',
			'role': 'tooltip'
		});
		this.volumeSliderTooltip.style.display = 'none';
		this.volumeRange = this.createEl('input', {
			'type': 'range',
			'min': '0',
			'max': '10',
			'step': '1',
			'orient': 'vertical', // non-standard, but required for Firefox
			'aria-label': this.translate( 'volumeUpDown', 'Volume up down' ),
			'value': this.volume
		});
		volumePct = parseInt(thisObj.volume) / 10 * 100;
		this.volumeHelp = this.createEl('div', {
			'id': volumeHelpId,
			'class': 'able-volume-help',
			'aria-live': 'polite',
			text: volumePct + '%'
		});
		volumeLabel = this.volumeButton.getAttribute( 'aria-label' );
		this.volumeButton.setAttribute( 'aria-label', volumeLabel + ' ' + volumePct + '%');
		this.volumeSlider.append(this.volumeSliderTooltip, this.volumeRange, this.volumeHelp);
		volumeHeight = this.volumeButton.closest( '.able-control-row' );
		this.volumeSlider.style.bottom = volumeHeight.offsetHeight + 'px';

		div.append(this.volumeSlider);

		// add event listeners
		this.volumeRange.addEventListener('change', function (e) {
			thisObj.handleVolumeChange(this.value);
		});

		this.volumeRange.addEventListener('input', function (e) {
			thisObj.handleVolumeChange(this.value);
		});

		this.volumeRange.addEventListener('keydown', function (e) {

			if (e.key === 'Escape' || e.key === 'Tab' || e.key === 'Enter') {
				// close popup
				if (thisObj.volumeSlider.offsetParent !== null || thisObj.volumeSlider.getClientRects().length) {
					thisObj.closingVolume = true; // stopgap
					thisObj.hideVolumePopup();
				} else {
					if (!thisObj.closingVolume) {
						thisObj.showVolumePopup();
					}
				}
			} else {
				return;
			}
		});
	};

	AblePlayer.prototype.refreshVolumeHelp = function(volume) {

		// make adjustments based on current volume
		var volumePct;
		volumePct = (volume/10) * 100;

		// Update help text
		if (this.volumeHelp) {
			this.volumeHelp.textContent = volumePct + '%';
		}

		// Update the default value of the volume slider input field
		// This doesn't seem to be necessary; browsers remember the previous setting during a session
		// but this is a fallback in case they don't
		this.volumeRange.setAttribute('value', volume);
	};

	AblePlayer.prototype.refreshVolumeButton = function(volume) {

		var volumeName, volumePct, volumeLabel;

		volumeName = this.getVolumeName(volume);
		volumePct = (volume/10) * 100;
		volumeLabel = this.translate( 'volume', 'Volume' ) + ' ' + volumePct + '%';

		this.getIcon( this.volumeButton, 'volume-' + volumeName );
		this.volumeButton.setAttribute( 'aria-label', volumeLabel );
	};

	AblePlayer.prototype.handleVolumeButtonClick = function() {

		if (this.volumeSlider.offsetParent !== null || this.volumeSlider.getClientRects().length) {
			this.hideVolumePopup();
		} else {
			this.showVolumePopup();
		}
	};

	AblePlayer.prototype.handleVolumeKeystroke = function(volume) {
		// keyboard shortcuts for changing volume
		if (this.isMuted() && volume > 0) {
			this.setMute(false);
		} else if (volume === 0) {
			this.setMute(true);
		} else {
			this.setVolume(volume); // this.volume will be updated after volumechange event fires (event.js)
			this.refreshVolumeHelp(volume);
			this.refreshVolumeButton(volume);
		}
	};


	AblePlayer.prototype.handleVolumeChange = function(volume) {

		// handle volume change using the volume input slider

		if (this.isMuted() && volume > 0) {
			this.setMute(false);
		} else if (volume === 0) {
			this.setMute(true);
		} else {
			this.setVolume(volume); // this.volume will be updated after volumechange event fires (event.js)
			this.refreshVolumeHelp(volume);
			this.refreshVolumeButton(volume);
		}
	};

	AblePlayer.prototype.handleMute = function() {

		if (this.isMuted()) {
			this.setMute(false);
		} else {
			this.setMute(true);
		}
	};

	AblePlayer.prototype.showVolumePopup = function() {

		this.closePopups();
		this.tooltipDiv.style.display = 'none';
		this.volumeSlider.style.display = '';
		this.volumeSlider.setAttribute('aria-hidden','false');
		this.volumeButton.setAttribute('aria-expanded','true');
		this.volumeButton.focus(); // for screen reader expanded state to be read
		this.waitThenFocus(this.volumeRange);
	};

	AblePlayer.prototype.hideVolumePopup = function() {

		var thisObj = this;

		this.volumeSlider.style.display = 'none';
		this.volumeSlider.setAttribute('aria-hidden','true');
		this.volumeButton.setAttribute('aria-expanded','false');
		this.volumeButton.focus();
		// wait a second before resetting stopgap var
		// otherwise the keypress used to close volume popup will trigger the volume button
		setTimeout(function() {
			thisObj.closingVolume = false;
		}, 1000);
	};

	AblePlayer.prototype.isMuted = function () {

		if (this.player === 'html5') {
			return this.media.muted;
		} else if (this.player === 'youtube') {
			return this.youTubePlayer.isMuted();
		}
	};

	AblePlayer.prototype.setMute = function(mute) {

		// mute is either true (muting) or false (unmuting)
		if (mute) {
			// save current volume so it can be restored after unmute
			this.lastVolume = this.volume;
			this.volume = 0;
		} else { // restore to previous volume
			if (typeof this.lastVolume !== 'undefined') {
				this.volume = this.lastVolume;
			}
		}

		if (this.player === 'html5') {
			this.media.muted = mute;
		} else if (this.player === 'youtube') {
			if (mute) {
				this.youTubePlayer.mute();
			} else {
				this.youTubePlayer.unMute();
			}
		}
		this.setVolume(this.volume);
		this.refreshVolumeHelp(this.volume);
		this.refreshVolumeButton(this.volume);
	};

	AblePlayer.prototype.setVolume = function (volume) {

		// volume is 1 to 10
		// convert as needed depending on player

		var newVolume;
		this.syncSignVideo( {'volume' : 0 } );
		if (this.player === 'html5') {
			// volume is 0 to 1
			newVolume = volume / 10;
			this.media.volume = newVolume;
		} else if (this.player === 'youtube') {
			// volume is 0 to 100
			newVolume = volume * 10;
			this.youTubePlayer.setVolume(newVolume);
			this.volume = volume;
		} else if (this.player === 'vimeo') {
			// volume is 0 to 1
			newVolume = volume / 10;
			this.vimeoPlayer.setVolume(newVolume).then(function() {
				// setVolume finished.
				// successful completion also fires a 'volumechange' event (see event.js)
			});
		}
		this.lastVolume = volume;
	};

	AblePlayer.prototype.getVolume = function (volume) {

		// return volume using common audio control scale 1 to 10
		if (this.player === 'html5') {
			// uses 0 to 1 scale
			return this.media.volume * 10;
		} else if (this.player === 'youtube') {
			// uses 0 to 100 scale
			if (this.youTubePlayerReady) {
				return this.youTubePlayer.getVolume() / 10;
			}
		}
		if (this.player === 'vimeo') {
			// uses 0 to 1 scale
			// this.vimeoPlayer.getVolume() takes too long to resolve with a value
			// Just use variable that's already been defined (should be the same value anyway)
			return this.volume;
		}
	};

	AblePlayer.prototype.getVolumeName = function (volume) {

		// returns 'mute','soft','medium', or 'loud' depending on volume level
		if (volume == 0) {
			return 'mute';
		} else if (volume == 10) {
			return 'loud';
		} else if (volume < 5) {
			return 'soft';
		} else {
			return 'medium';
		}
	};

}

export default addVolumeFunctions;
