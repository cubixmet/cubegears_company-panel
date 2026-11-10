import { settingsService } from './settings.service';
import apiClient from '../api/apiClient';

// Saved by the Django CompanySetting model, isolated per authenticated tenant.
// These defaults are also used while loading and for legacy finalized invoices.
export const templateDefaults = {
  invoiceTemplate: 'modern',
  estimateTemplate: 'modern',
  accent: 'teal',
  showOriginal: true,
  showSellerMark: true,
  compactTable: false,
  customName: '',
  customHeader: '',
  customFooter: '',
  customShowTransport: true,
  customShowTaxTable: true,
  businessLogo: '',
  businessName: '',
  businessLegalName: '',
  businessGstin: '',
  businessPhone: '',
  businessEmail: '',
  businessAddress: '',
  businessState: '',
  businessStateCode: '',
  businessWebsite: '',
  businessPan: '',
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  bankUpi: '',
  authorizedSignatory: '',
  termsText: '',
  showBusinessLogo: true,
  showGstin: true,
  showPan: true,
  showWebsite: true,
  showBankDetails: true,
  showTerms: true,
  showSignature: true
};

export const loadDocumentTemplateSettings = async () => ({
  ...templateDefaults,
  ...(await settingsService.getSettings('document_templates')),
});

// Profile fields inherited from the real workshop, onboarding logo and
// selected bank. Styling, terms and template selections are never reset.
export const WORKSHOP_TEMPLATE_FIELDS = [
  'businessLogo', 'businessName', 'businessLegalName', 'businessGstin',
  'businessPhone', 'businessEmail', 'businessAddress', 'businessState',
  'businessStateCode', 'businessPan', 'bankName', 'bankAccountName',
  'bankAccountNumber', 'bankIfsc',
];

export const loadWorkshopTemplateDetails = () =>
  apiClient.get('/settings/document_templates', {
    params: { workshop_defaults: '1' },
  });

export const saveDocumentTemplateSettings = async (settings) =>
  settingsService.updateSettings('document_templates', settings);

export const resolveDocumentAppearance = (kind, currentSettings, savedSnapshot = null, finalized = false) => {
  const source = savedSnapshot && Object.keys(savedSnapshot).length
    ? savedSnapshot
    : finalized ? { ...templateDefaults, accent: 'blue' } : currentSettings;
  return { ...templateDefaults, ...(source || {}),
    selectedTemplate: kind === 'estimate'
      ? (source?.estimateTemplate || templateDefaults.estimateTemplate)
      : (source?.invoiceTemplate || templateDefaults.invoiceTemplate),
  };
};
