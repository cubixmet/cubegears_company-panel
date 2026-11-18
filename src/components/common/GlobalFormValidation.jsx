import { useEffect } from 'react';
import { clearFieldValidation, focusField, setFieldValidation } from '../../utils/formValidation';
import { addDefaultFormPlaceholders } from '../../utils/formPlaceholders';

/**
 * Capture native constraint errors across the company panel, including
 * modal/portal forms. Browser invalid events do not bubble, so use capture.
 * The first invalid input is focused after all fields have been annotated.
 */
export function GlobalFormValidation() {
  useEffect(() => {
    let firstInvalid = null;
    let animationFrame = null;
    let pendingReactField = null;

    const isInvalid = (field) => field?.getAttribute('aria-invalid') === 'true'
      || field?.dataset.cgErrorActive === 'true';

    const focusFirstInForm = (field) => {
      const form = field.closest('form');
      const first = form
        ? [...form.querySelectorAll('input:not([type="hidden"]), select, textarea')]
          .find((candidate) => isInvalid(candidate) && candidate.getClientRects().length > 0)
        : field;
      if (first?.isConnected) focusField(first);
    };

    const onInvalid = (event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement
        || field instanceof HTMLSelectElement
        || field instanceof HTMLTextAreaElement)) return;
      if (field.disabled || field.closest('[data-disable-global-validation]')) return;

      // Replace the browser popover with an accessible inline error.
      event.preventDefault();
      setFieldValidation(field, field.validationMessage || 'Check this field.', false);
      if (!firstInvalid) firstInvalid = field;
      if (animationFrame !== null) return;

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        const target = firstInvalid;
        firstInvalid = null;
        if (target?.isConnected) focusField(target);
      });
    };

    const onEdit = (event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement
        || field instanceof HTMLSelectElement
        || field instanceof HTMLTextAreaElement)) return;
      if (field.dataset.cgErrorActive !== 'true') return;
      if (field.validity.valid) clearFieldValidation(field);
      else setFieldValidation(field, field.validationMessage || 'Check this field.', false);
    };

    const onReactValidation = (mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element) addDefaultFormPlaceholders(node);
          });
        }
        if (mutation.type !== 'attributes' || !isInvalid(mutation.target)) continue;
        const target = mutation.target;
        if (target.closest('[data-disable-global-validation]')) continue;
        if (target instanceof HTMLInputElement
          || target instanceof HTMLSelectElement
          || target instanceof HTMLTextAreaElement) pendingReactField ||= target;
      }
      if (!pendingReactField || animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        const field = pendingReactField;
        pendingReactField = null;
        if (field?.isConnected && isInvalid(field)) focusFirstInForm(field);
      });
    };

    addDefaultFormPlaceholders(document);
    const observer = new MutationObserver(onReactValidation);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-invalid', 'data-cg-error-active'],
    });

    document.addEventListener('invalid', onInvalid, true);
    document.addEventListener('input', onEdit, true);
    document.addEventListener('change', onEdit, true);

    return () => {
      document.removeEventListener('invalid', onInvalid, true);
      document.removeEventListener('input', onEdit, true);
      document.removeEventListener('change', onEdit, true);
      observer.disconnect();
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return null;
}
