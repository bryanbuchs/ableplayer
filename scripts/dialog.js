// Accessible modal dialog backed by the native <dialog> element.
//
// The native <dialog> (opened with showModal()) provides, for free, the behavior
// this class used to hand-roll: focus trapping, Escape-to-dismiss, inert
// background, top-layer stacking, a ::backdrop, and focus restore on close.
//
// `modalElement` MUST be a native <dialog> element. Callers build their content
// inside a <dialog> (see preference.js, dragdrop.js, transcript.js) and pass it here.
function AccessibleDialog( modalElement, returnElement, title, closeButtonLabel) {

	this.title = title;
	this.closeButtonLabel = closeButtonLabel;
	this.focusedElementBeforeModal = returnElement;
	this.baseId = modalElement.getAttribute('id') || Math.floor(Math.random() * 1000000000).toString();
	var thisObj = this;
	var modal = modalElement;
	this.modal = modal;

	modal.classList.add('able-modal-dialog');

	var closeButton = document.createElement('button');
	closeButton.className = 'modalCloseButton';
	closeButton.setAttribute('title', this.closeButtonLabel);
	closeButton.setAttribute('aria-label', this.closeButtonLabel);
	closeButton.textContent = '×';
	closeButton.addEventListener('keydown', function (e) {
		if (e.key === ' ') {
			thisObj.hide();
		}
	});
	closeButton.addEventListener('click', function () {
		thisObj.hide();
	});

	var titleH1 = document.createElement('h1');
	titleH1.setAttribute('id', 'modalTitle-' + this.baseId);
	titleH1.textContent = title;
	this.titleH1 = titleH1;

	modal.setAttribute('aria-labelledby', 'modalTitle-' + this.baseId);

	var modalHeader = document.createElement('div');
	modalHeader.className = 'able-modal-header';
	// Preserve original DOM order: close button first, then the title heading.
	modalHeader.append(closeButton);
	modalHeader.append(titleH1);
	modal.prepend(modalHeader);

	modal.setAttribute('role', 'dialog');
	modal.setAttribute('aria-modal', 'true');

	// Escape fires the native 'cancel' event; route through hide() for any cleanup.
	modal.addEventListener('cancel', function (e) {
		e.preventDefault();
		thisObj.hide();
	});

	// Light dismiss: a click on the backdrop (the dialog element itself) closes.
	modal.addEventListener('click', function (e) {
		if (e.target === modal) {
			thisObj.hide();
		}
	});
}

AccessibleDialog.prototype.show = function () {
	var thisObj = this;
	if (typeof this.modal.showModal === 'function') {
		this.modal.showModal();
	} else {
		// Fallback for environments without <dialog> support
		this.modal.setAttribute('open', '');
		this.modal.style.display = 'block';
	}
	// Native <dialog> focuses the first focusable element automatically; be explicit
	// about the close button to match the previous behavior.
	setTimeout(function () {
		var btn = thisObj.modal.querySelector('button.modalCloseButton');
		if (btn) {
			btn.focus();
		}
	}, 300);
};

AccessibleDialog.prototype.hide = function () {
	if (typeof this.modal.close === 'function') {
		this.modal.close();
	} else {
		this.modal.removeAttribute('open');
		this.modal.style.display = 'none';
	}
	// Native <dialog> restores focus automatically, but be explicit for the
	// designated return element (and for non-supporting browsers).
	var returnEl = this.focusedElementBeforeModal;
	if (returnEl && returnEl.jquery) {
		returnEl = returnEl[0];
	}
	if (returnEl && typeof returnEl.focus === 'function') {
		returnEl.focus();
	}
};

AccessibleDialog.prototype.getInputs = function () {
	// return a NodeList of input elements within this dialog
	if (this.modal) {
		return this.modal.querySelectorAll('input');
	}
	return false;
};

export default AccessibleDialog;
