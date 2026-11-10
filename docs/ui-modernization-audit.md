# CubeGears UI modernization — incremental implementation

Scope: 2026-11-05 master prompt for accessible outlined floating labels,
shared typography, concise text, light/dark mode, and mobile forms.

## Audited foundations
- Shared React controls: src/components/ui/{Input,Select,Textarea,PhoneInput}.jsx
- Shared searchable select: src/components/common/forms/SearchableSelect.jsx
- Theme: src/context/ThemeContext.jsx + semantic tokens from src/index.css
- Form architecture: src/styles/{component-system,form-controls-unified,form-typography,form-errors-unified,desktop-typography}.css
- Validation: src/components/common/GlobalFormValidation.jsx
- Representative forms: Add Customer, Add Vehicle, Stock, Services, Outside Labour, Job Work Stock.

## Implemented in this branch
- Native React Input, Select, Textarea, PhoneInput: label is now inside a single
  outlined shell, linked using the existing htmlFor / id relationship.
- Floating labels respond to focus, nonempty values, autofill and errors.
- Native selects float their label while keeping the platform picker.
- Defaults: 48px fields, 10px radii, readable 16px text, theme tokens and error
  states. Search shells and independent checkboxes/radio/file inputs are not altered.
- Existing SearchableSelect: accessible combobox, keyboard navigation, input
  search, deduplicated options, clear, outside click, and selection semantics.
- Simplified redundant helper descriptions on selected Customers, Vehicles,
  Services, Inventory and Job Work/Outside Staff views.
- GST context remains available as an expandable detail. Visible stock deduction,
  permissions and error messages remain unchanged.
- Added static regression and browser smoke checks for representative real
  components. Browser tests intercept API calls with fixtures only.

## Not yet claimed complete
- Many older pages define native label/input layouts rather than using shared
  form components. Those need explicit incremental component migrations.
- Not every modal, paragraph, super-admin page, Customer Website view, search
  dropdown or camera flow has been reviewed.
- Production API writes, customer-specific data, and permission combinations
  must be exercised in a real staging tenant before general release.
- Recheck all 320, 360, 375, 390, 430, 768, 1024, 1440 viewports across pages
  after each module migration; do not make global CSS hide meaningful content.
