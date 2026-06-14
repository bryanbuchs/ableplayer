
	// Events:
	// - startTracking(event, position)
	// - tracking(event, position)
	// - stopTracking(event, position)

	function AccessibleSlider(div, max, bigInterval, label) {

		// div is the host element around which the slider will be built
		// max is the high end of the slider scale
		// bigInterval is the number of steps supported by page up/page down (set to 0 if not supported)
		// (smallInterval, defined as nextStep below, is always set to 1) - this is the interval supported by arrow keys
		// label is used within an aria-label attribute to identify the slider to screen reader users

		var thisObj, coords;

		thisObj = this;

		// Initialize some variables.
		this.position = 0; // Note: position does not change while tracking.
		this.tracking = false;
		this.trackDevice = null; // 'mouse' or 'keyboard'
		this.keyTrackPosition = 0;
		this.lastTrackPosition = 0;
		this.nextStep = 1;
		this.inertiaCount = 0;

		this.seekbarDiv = div;

		// Add divs for tracking amount of media loaded and played
		this.loadedDiv = document.createElement('div');
		this.playedDiv = document.createElement('div');

		// Add a seekhead
		this.seekHead = document.createElement('div');
		this.seekHead.setAttribute('aria-orientation', 'horizontal');
		this.seekHead.setAttribute('class', 'able-seekbar-head');

		this.seekHead.setAttribute('tabindex', '0');

		// Since head is focusable, it gets the aria roles/titles.
		this.seekHead.setAttribute('role', 'slider');
		this.seekHead.setAttribute('aria-label', label);
		this.seekHead.setAttribute('aria-valuemin', 0);
		this.seekHead.setAttribute('aria-valuemax', max);

		this.timeTooltipTimeoutId = null;
		this.overTooltip = false;
		this.timeTooltip = document.createElement('div');
		this.seekbarDiv.append(this.timeTooltip);

		this.timeTooltip.setAttribute('role', 'tooltip');
		this.timeTooltip.classList.add('able-tooltip');
		this.timeTooltip.addEventListener('mouseenter', function(){
			thisObj.overTooltip = true;
			clearInterval(thisObj.timeTooltipTimeoutId);
		});
		this.timeTooltip.addEventListener('focus', function(){
			thisObj.overTooltip = true;
			clearInterval(thisObj.timeTooltipTimeoutId);
		});
		this.timeTooltip.addEventListener('mouseleave', function(){
			thisObj.overTooltip = false;
			this.style.display = 'none';
		});
		this.timeTooltip.addEventListener('blur', function(){
			thisObj.overTooltip = false;
			this.style.display = 'none';
		});
		this.timeTooltip.style.display = 'none';

		this.seekbarDiv.append(this.loadedDiv);
		this.seekbarDiv.append(this.playedDiv);
		this.seekbarDiv.append(this.seekHead);
		// wrap seekbarDiv in a new wrapper div
		this.wrapperDiv = document.createElement('div');
		this.seekbarDiv.replaceWith(this.wrapperDiv);
		this.wrapperDiv.append(this.seekbarDiv);

		if (this.skin === 'legacy') {
			this.wrapperDiv.style.width = 100 + 'px';
			this.loadedDiv.style.width = 0 + 'px';
		}
		this.wrapperDiv.classList.add('able-seekbar-wrapper');
		this.loadedDiv.classList.add('able-seekbar-loaded');
		this.playedDiv.style.width = 0 + 'px';
		this.playedDiv.classList.add('able-seekbar-played');

		// Set a default duration. User can call this dynamically if duration changes.
		this.setDuration(max);

		// handle seekHead events
		var seekHeadHandler = function (e) {

			coords = thisObj.pointerEventToXY(e);

			if (e.type === 'mouseenter' || e.type === 'focus') {
				thisObj.overHead = true;
			} else if (e.type === 'mouseleave' || e.type === 'blur') {
				thisObj.overHead = false;
				if (!thisObj.overBody && thisObj.tracking && thisObj.trackDevice === 'mouse') {
					thisObj.stopTracking(thisObj.pageXToPosition(coords.x));
				}
			} else if (e.type === 'mousemove' || e.type === 'touchmove') {
				if (thisObj.tracking && thisObj.trackDevice === 'mouse') {
					thisObj.trackHeadAtPageX(coords.x);
				}
			} else if (e.type === 'mousedown' || e.type === 'touchstart') {
				// Note: faithfully preserves original behavior, where .offset() returned an
				// object (not .left); object + number coerces to a string here as it did before.
				thisObj.startTracking('mouse', thisObj.pageXToPosition(thisObj.seekHeadOffset() + (thisObj.seekHeadWidth() / 2)));
				if (document.activeElement !== thisObj.seekbarDiv) {
					thisObj.seekbarDiv.focus();
				}
				e.preventDefault();
			} else if (e.type === 'mouseup' || e.type === 'touchend') {
				if (thisObj.tracking && thisObj.trackDevice === 'mouse') {
					thisObj.stopTracking(thisObj.pageXToPosition(coords.x));
				}
			}
			if (e.type !== 'mousemove' && e.type !== 'mousedown' && e.type !== 'mouseup' && e.type !== 'touchstart' && e.type !== 'touchend') {
				thisObj.refreshTooltip();
			}
		};
		'mouseenter mouseleave mousemove mousedown mouseup focus blur touchstart touchmove touchend'.split(' ').forEach(function (evt) {
			thisObj.seekHead.addEventListener(evt, seekHeadHandler);
		});

		// handle seekbarDiv events
		var seekbarHandler = function (e) {

			// Don't trigger move on right click.
			if ( e.button == 2 && e.type == 'mousedown' ) {
				return;
			}
			coords = thisObj.pointerEventToXY(e);
			let keyPressed = e.key;

			if (e.type === 'mouseenter') {
				thisObj.overBody = true;
				thisObj.overBodyMousePos = {
					x: coords.x,
					y: coords.y
				};
			} else if (e.type === 'mouseleave') {
				thisObj.overBody = false;
				thisObj.overBodyMousePos = null;
				if (!thisObj.overHead && thisObj.tracking && thisObj.trackDevice === 'mouse') {
					thisObj.stopTracking(thisObj.pageXToPosition(coords.x));
				}
			} else if (e.type === 'mousemove' || e.type === 'touchmove') {
				thisObj.overBodyMousePos = {
					x: coords.x,
					y: coords.y
				};
				if (thisObj.tracking && thisObj.trackDevice === 'mouse') {
					thisObj.trackHeadAtPageX(coords.x);
				}
			} else if (e.type === 'mousedown' || e.type === 'touchstart') {
				thisObj.startTracking('mouse', thisObj.pageXToPosition(coords.x));
				thisObj.trackHeadAtPageX(coords.x);
				if (document.activeElement !== thisObj.seekHead) {
					thisObj.seekHead.focus();
				}
				e.preventDefault();
			} else if (e.type === 'mouseup' || e.type === 'touchend') {
				if (thisObj.tracking && thisObj.trackDevice === 'mouse') {
					thisObj.stopTracking(thisObj.pageXToPosition(coords.x));
				}
			} else if (e.type === 'keydown') {
				if (e.key === 'Home') {
					thisObj.trackImmediatelyTo(0);
				} else if (e.key === 'End') {
					thisObj.trackImmediatelyTo(thisObj.duration);
				} else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
					thisObj.arrowKeyDown(-1);
				} else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
					thisObj.arrowKeyDown(1);
				} else if (e.key === 'PageUp' && bigInterval > 0) {
					thisObj.arrowKeyDown(bigInterval);
				} else if (e.key === 'PageDown' && bigInterval > 0) {
					thisObj.arrowKeyDown(-bigInterval);
				} else {
					return;
				}
				e.preventDefault();
			} else if (e.type === 'keyup') {
				if ( keyPressed === e.key ) {
					if (thisObj.tracking && thisObj.trackDevice === 'keyboard') {
						thisObj.stopTracking(thisObj.keyTrackPosition);
					}
					e.preventDefault();
				}
			}
			if (!thisObj.overTooltip && e.type !== 'mouseup' && e.type !== 'keydown' && e.type !== 'keydown') {
				thisObj.refreshTooltip();
			}
		};
		'mouseenter mouseleave mousemove mousedown mouseup keydown keyup touchstart touchmove touchend'.split(' ').forEach(function (evt) {
			thisObj.seekbarDiv.addEventListener(evt, seekbarHandler);
		});
	}

	AccessibleSlider.prototype.arrowKeyDown = function (multiplier) {
		if (this.tracking && this.trackDevice === 'keyboard') {
			this.keyTrackPosition = this.boundPos(this.keyTrackPosition + (this.nextStep * multiplier));
			this.inertiaCount += 1;
			if (this.inertiaCount === 20) {
				this.inertiaCount = 0;
				this.nextStep *= 2;
			}
			this.trackHeadAtPosition(this.keyTrackPosition);
		} else {
			this.nextStep = 1;
			this.inertiaCount = 0;
			this.keyTrackPosition = this.boundPos(this.position + (this.nextStep * multiplier));
			this.startTracking('keyboard', this.keyTrackPosition);
			this.trackHeadAtPosition(this.keyTrackPosition);
		}
	};

	// returns the document-relative left offset of the seekbarDiv (former jQuery .offset().left)
	AccessibleSlider.prototype.seekbarDivOffsetLeft = function () {
		var r = this.seekbarDiv.getBoundingClientRect();
		return r.left + window.scrollX;
	};

	// returns the document-relative offset object of the seekHead (former jQuery .offset())
	AccessibleSlider.prototype.seekHeadOffset = function () {
		var r = this.seekHead.getBoundingClientRect();
		return { top: r.top + window.scrollY, left: r.left + window.scrollX };
	};

	AccessibleSlider.prototype.seekbarDivWidth = function () {
		return this.seekbarDiv.getBoundingClientRect().width;
	};

	AccessibleSlider.prototype.seekHeadWidth = function () {
		return this.seekHead.getBoundingClientRect().width;
	};

	AccessibleSlider.prototype.pageXToPosition = function (pageX) {
		var offset = pageX - this.seekbarDivOffsetLeft();
		var position = this.duration * (offset / this.seekbarDivWidth());
		return this.boundPos(position);
	};

	AccessibleSlider.prototype.boundPos = function (position) {
		return Math.max(0, Math.min(position, this.duration));
	}

	AccessibleSlider.prototype.setDuration = function (duration) {
		if (duration !== this.duration) {
			this.duration = duration;
			this.resetHeadLocation();
			this.seekHead.setAttribute('aria-valuemax', duration);
		}
	};

	// Set width of the legacy seekbar.
	AccessibleSlider.prototype.setWidth = function (width) {
		this.wrapperDiv.style.width = width + 'px';
		this.resizeDivs();
		this.resetHeadLocation();
	};

	AccessibleSlider.prototype.getWidth = function () {
		return this.wrapperDiv.getBoundingClientRect().width;
	};

	AccessibleSlider.prototype.resizeDivs = function () {
		this.playedDiv.style.width = 100 * (this.position / this.duration) + '%';
		this.loadedDiv.style.width = 100 * this.buffered + '%';
	};

	// Stops tracking, sets the head location to the current position.
	AccessibleSlider.prototype.resetHeadLocation = function () {
		var ratio = this.position / this.duration;
		var center = this.seekbarDivWidth() * ratio;
		this.seekHead.style.left = (center - (this.seekHeadWidth() / 2)) + 'px';

		if (this.tracking) {
			this.stopTracking(this.position);
		}
	};

	AccessibleSlider.prototype.setPosition = function (position, updateLive) {
		this.position = position;
		this.resetHeadLocation();
		if (this.overHead) {
			this.refreshTooltip();
		}
		this.resizeDivs();
		this.updateAriaValues(position, updateLive);
	}

	// TODO: Native HTML5 can have several buffered segments, and this actually happens quite often. Change this to display them all.
	AccessibleSlider.prototype.setBuffered = function (ratio) {
		if (!isNaN(ratio)) {
			this.buffered = ratio;
			this.redrawDivs;
		}
	}

	AccessibleSlider.prototype.startTracking = function (device, position) {
		if (!this.tracking) {
			this.trackDevice = device;
			this.tracking = true;
			this.seekbarDiv.dispatchEvent(new CustomEvent('startTracking', { detail: position, bubbles: true }));
		}
	};

	AccessibleSlider.prototype.stopTracking = function (position) {
		this.trackDevice = null;
		this.tracking = false;
		this.seekbarDiv.dispatchEvent(new CustomEvent('stopTracking', { detail: position, bubbles: true }));
		this.setPosition(position, true);
	};

	AccessibleSlider.prototype.trackHeadAtPageX = function (pageX) {
		var position = this.pageXToPosition(pageX);
		var newLeft = pageX - this.seekbarDivOffsetLeft() - (this.seekHeadWidth() / 2);
		newLeft = Math.max(0, Math.min(newLeft, this.seekbarDivWidth() - this.seekHeadWidth()));
		this.lastTrackPosition = position;
		this.seekHead.style.left = newLeft + 'px';
		this.reportTrackAtPosition(position);
	};

	AccessibleSlider.prototype.trackHeadAtPosition = function (position) {
		var ratio = position / this.duration;
		var center = this.seekbarDivWidth() * ratio;
		this.lastTrackPosition = position;
		this.seekHead.style.left = (center - (this.seekHeadWidth() / 2)) + 'px';
		this.reportTrackAtPosition(position);
	};

	AccessibleSlider.prototype.reportTrackAtPosition = function (position) {
		this.seekbarDiv.dispatchEvent(new CustomEvent('tracking', { detail: position, bubbles: true }));
		this.updateAriaValues(position, true);
	};

	AccessibleSlider.prototype.updateAriaValues = function (position, updateLive) {
		// TODO: Localize, move to another function.
		var pHours = Math.floor(position / 3600);
		var pMinutes = Math.floor((position % 3600) / 60);
		var pSeconds = Math.floor(position % 60);

		var pHourWord = pHours === 1 ? 'hour' : 'hours';
		var pMinuteWord = pMinutes === 1 ? 'minute' : 'minutes';
		var pSecondWord = pSeconds === 1 ? 'second' : 'seconds';

		var descriptionText;
		if (pHours > 0) {
			descriptionText = pHours +
				' ' + pHourWord +
				', ' + pMinutes +
				' ' + pMinuteWord +
				', ' + pSeconds +
				' ' + pSecondWord;
		} else if (pMinutes > 0) {
			descriptionText	 = pMinutes +
				' ' + pMinuteWord +
				', ' + pSeconds +
				' ' + pSecondWord;
		} else {
			descriptionText = pSeconds + ' ' + pSecondWord;
		}

		/* Comment to stop live region from generating or being used. */
		if (!this.liveAriaRegion) {
			this.liveAriaRegion = document.createElement('span');
			this.liveAriaRegion.setAttribute('class', 'able-offscreen');
			this.liveAriaRegion.setAttribute('aria-live', 'polite');
			this.wrapperDiv.append(this.liveAriaRegion);
		}
		if (updateLive && (this.liveAriaRegion.textContent !== descriptionText)) {
			this.liveAriaRegion.textContent = descriptionText;
		}

		// Uncomment the following lines to use aria values instead of separate live region.
		this.seekHead.setAttribute('aria-valuetext', descriptionText);
		this.seekHead.setAttribute('aria-valuenow', Math.floor(position).toString());
	};

	AccessibleSlider.prototype.trackImmediatelyTo = function (position) {
		this.startTracking('keyboard', position);
		this.trackHeadAtPosition(position);
		this.keyTrackPosition = position;
	};

	AccessibleSlider.prototype.refreshTooltip = function () {
		if (this.overHead) {
			this.timeTooltip.style.display = '';
			if (this.tracking) {
				this.timeTooltip.textContent = this.positionToStr(this.lastTrackPosition);
			} else {
				this.timeTooltip.textContent = this.positionToStr(this.position);
			}
			this.setTooltipPosition(this.seekHead.offsetLeft + (this.seekHeadWidth() / 2));
		} else if (this.overBody && this.overBodyMousePos) {
			this.timeTooltip.style.display = '';
			this.timeTooltip.textContent = this.positionToStr(this.pageXToPosition(this.overBodyMousePos.x));
			this.setTooltipPosition(this.overBodyMousePos.x - this.seekbarDivOffsetLeft());
		} else {

			clearTimeout(this.timeTooltipTimeoutId);
			var _this = this;
			this.timeTooltipTimeoutId = setTimeout(function() {
				// give user a half second move cursor over tooltip
				_this.timeTooltip.style.display = 'none';
			}, 500);
		}
	};

	AccessibleSlider.prototype.hideSliderTooltips = function () {
		this.overHead = false;
		this.overBody = false;
		this.timeTooltip.style.display = 'none';
	};

	AccessibleSlider.prototype.setTooltipPosition = function (x) {
		this.timeTooltip.style.left = (x - (this.timeTooltip.getBoundingClientRect().width / 2) - 10) + 'px';
		this.timeTooltip.style.bottom = this.seekHead.getBoundingClientRect().height + 'px';
	};

	AccessibleSlider.prototype.positionToStr = function (seconds) {

		// same logic as misc.js > formatSecondsAsColonTime()
		var dHours = Math.floor(seconds / 3600);
		var dMinutes = Math.floor(seconds / 60) % 60;
		var dSeconds = Math.floor(seconds % 60);
		if (dSeconds < 10) {
			dSeconds = '0' + dSeconds;
		}
		if (dHours > 0) {
			if (dMinutes < 10) {
				dMinutes = '0' + dMinutes;
			}
			return dHours + ':' + dMinutes + ':' + dSeconds;
		} else {
			return dMinutes + ':' + dSeconds;
		}
	};

	AccessibleSlider.prototype.pointerEventToXY = function(e) {

		// returns array of coordinates x and y in response to both mouse and touch events
		// for mouse events, this comes from e.pageX and e.pageY
		// for touch events, it's a bit more complicated
		var out = {x:0, y:0};
		if (e.type == 'touchstart' || e.type == 'touchmove' || e.type == 'touchend' || e.type == 'touchcancel') {
			var touch = e.touches[0] || e.changedTouches[0];
			out.x = touch.pageX;
			out.y = touch.pageY;
		} else if (e.type == 'mousedown' || e.type == 'mouseup' || e.type == 'mousemove' || e.type == 'mouseover'|| e.type=='mouseout' || e.type=='mouseenter' || e.type=='mouseleave') {
			out.x = e.pageX;
			out.y = e.pageY;
		}
		return out;
	};

export default AccessibleSlider;
