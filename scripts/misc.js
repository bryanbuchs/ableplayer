function addMiscFunctions(AblePlayer) {
  AblePlayer.prototype.getNextHeadingLevel = function (element) {
    // Finds the nearest heading in the ancestor tree
    // Loops over each parent of the current element until a heading is found
    // If multiple headings are found beneath a given parent, get the closest
    // Returns an integer (1-6) representing the next available heading level

    var el, parent, foundHeadings, headingType, headingNumber;

    // Tolerate a jQuery object during the vanilla-JS migration
    el = (element && element.jquery) ? element[0] : element;

    parent = el ? el.parentElement : null;
    while (parent) {
      // direct children that are headings (h1-h6); keep the last one found
      foundHeadings = Array.prototype.filter.call(parent.children, function (child) {
        return /^H[1-6]$/.test(child.tagName);
      });
      if (foundHeadings.length) {
        headingType = foundHeadings[foundHeadings.length - 1].tagName;
        break;
      }
      parent = parent.parentElement;
    }
    if (typeof headingType === "undefined") {
      // page has no headings
      headingNumber = 1;
    } else {
      // Increment closest heading by one if less than 6.
      headingNumber = parseInt(headingType[1]);
      headingNumber += 1;
      if (headingNumber > 6) {
        headingNumber = 6;
      }
    }
    return headingNumber;
  };

  AblePlayer.prototype.countProperties = function (obj) {
    // returns the number of properties in an object
    var count, prop;
    count = 0;
    for (prop in obj) {
      if (Object.hasOwn(obj, prop)) {
        ++count;
      }
    }
    return count;
  };

  AblePlayer.prototype.formatSecondsAsColonTime = function (
    seconds,
    showFullTime
  ) {
    // Takes seconds and converts to string of form hh:mm:ss
    // If showFullTime is true, shows 00 for hours if time is less than an hour
    //	 and show milliseconds	(e.g., 00:00:04.123 as in Video Track Sorter)
    // Otherwise, omits empty hours and milliseconds (e.g., 00:04 as in timer on controller)

    var times,format,parts,milliSeconds,numShort,i;

    if (showFullTime) {
      // preserve milliseconds, if included in seconds
      parts = seconds.toString().split(".");
      if (parts.length === 2) {
        milliSeconds = parts[1];
        if (milliSeconds.length < 3) {
          numShort = 3 - milliSeconds.length;
          for (i = 1; i <= numShort; i++) {
            milliSeconds += "0";
          }
        }
      } else {
        milliSeconds = "000";
      }
    }
	times = this.secondsToTime( seconds );
	format = times['value'];

	return (showFullTime) ? format + '.' + milliSeconds : format;
  };

  AblePlayer.prototype.getSecondsFromColonTime = function (timeStr) {
    // Converts string of form hh:mm:ss to seconds
    var timeParts, hours, minutes, seconds;

    timeParts = timeStr.split(":");
    if (timeParts.length === 3) {
      hours = parseInt(timeParts[0]);
      minutes = parseInt(timeParts[1]);
      seconds = parseFloat(timeParts[2]);
      return hours * 3600 + minutes * 60 + seconds;
    } else if (timeParts.length === 2) {
      minutes = parseInt(timeParts[0]);
      seconds = parseFloat(timeParts[1]);
      return minutes * 60 + seconds;
    } else if (timeParts.length === 1) {
      seconds = parseFloat(timeParts[0]);
      return seconds;
    }
  };

  AblePlayer.prototype.capitalizeFirstLetter = function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  AblePlayer.prototype.roundDown = function (value, decimals) {
    // round value down to the nearest X decimal points
    // where X is the value of the decimals parameter
    return Number(Math.floor(value + "e" + decimals) + "e-" + decimals);
  };

  AblePlayer.prototype.defer = function() {
	const self = this;
	const promise = new Promise((resolve, reject) => {
		self.resolve = resolve;
		self.reject = reject;
		self.promise = () => promise;
	});
  }

  AblePlayer.prototype.getScript = function( source, callback ) {
	var script   = document.createElement('script');
	var prior    = document.getElementsByTagName('script')[0];
	script.async = 1;

	script.onload = script.onreadystatechange = function( _, isAbort ) {
		if ( isAbort || !script.readyState || /loaded|complete/.test(script.readyState) ) {
			script.onload = script.onreadystatechange = null;
			script        = undefined;

			if ( !isAbort && callback ) {
				setTimeout(callback, 0);
			}
		}
	};

	script.src = source;
	prior.parentNode.insertBefore(script, prior);
  }

  AblePlayer.prototype.createEl = function (tag, options) {
    // Lightweight element factory replacing the jQuery $('<tag>', {...}) idiom.
    // Recognized option keys: 'class'/'className' -> className, 'text' -> textContent,
    // 'html' -> innerHTML; any other key is set as an attribute.
    var el = document.createElement(tag);
    if (options) {
      for (var key in options) {
        if (!Object.hasOwn(options, key)) {
          continue;
        }
        var val = options[key];
        if (key === 'class' || key === 'className') {
          el.className = val;
        } else if (key === 'text') {
          el.textContent = val;
        } else if (key === 'html') {
          el.innerHTML = val;
        } else {
          el.setAttribute(key, val);
        }
      }
    }
    return el;
  };

  AblePlayer.prototype.coerceDataValue = function (data) {
    // Mimics jQuery's data() string-to-type coercion so that markup like
    // data-use-chapters-button="false" yields the boolean false (not "false").
    if (data === 'true') {
      return true;
    }
    if (data === 'false') {
      return false;
    }
    if (data === 'null') {
      return null;
    }
    if (data === +data + '') {
      return +data;
    }
    if (/^(?:\{[\w\W]*\}|\[[\w\W]*\])$/.test(data)) {
      try {
        return JSON.parse(data);
      } catch (e) {
        return data;
      }
    }
    return data;
  };

  AblePlayer.prototype.getData = function (object, key) {
    // Native replacement for jQuery's $(el).data(key).
    // key is the hyphenated name without the 'data-' prefix (e.g. 'use-chapters-button').
    // Returns undefined when the attribute is absent (matching jQuery).
    var el = (object && object.jquery) ? object[0] : object;
    if (!el || !el.getAttribute) {
      return undefined;
    }
    var raw = el.getAttribute('data-' + key);
    if (raw === null) {
      return undefined;
    }
    return this.coerceDataValue(raw);
  };

  AblePlayer.prototype.hasAttr = function (object, attribute) {
    // return true if element has attribute; otherwise false
    // object is a native Element (a jQuery object is tolerated during migration)
    // attribute is a string

    var el = (object && object.jquery) ? object[0] : object;
    return !!(el && el.hasAttribute && el.hasAttribute(attribute));
  };

}

export default addMiscFunctions;
