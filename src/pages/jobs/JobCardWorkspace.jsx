import { appConfirm } from '../../components/common/appDialogs';
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, FileText, Gauge, History, PackageSearch, Plus, ReceiptText, ShieldCheck, Star, UserRound, Wrench, ChevronRight, Download, Share2, LockKeyhole, SkipForward } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { jobService } from '../../services/job.service';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { billingService } from '../../services/billing.service';
import { paymentService } from '../../services/payment.service';
import { USE_MOCK_API } from '../../api/apiConfig';
import { staffService } from '../../services/staff.service';
import { JobPartsWorkflow } from './JobPartsWorkflow';
import { JobInspectionPanel } from '../../components/jobs/JobInspectionPanel';
import { VehiclePhotoGallery } from '../../components/vehicles/VehiclePhotoGallery';
import { QuickEstimatePanel } from '../../components/jobs/QuickEstimatePanel';
import { JobQualityCheckPanel } from '../../components/jobs/JobQualityCheckPanel';
import { ResponsiveModalSheet } from '../../components/common/ResponsiveModalSheet';
import { InvoicePdfShareSheet } from '../../components/invoices/InvoicePdfShareSheet';
import { createApprovedEstimatePdfFile, downloadApprovedEstimatePdf, latestApprovedEstimate } from '../../utils/approvedEstimatePdf';
import '../../styles/approved-estimate-pdf.css';
import '../../styles/job-workspace-readable.css';
import '../../styles/job-estimate-iphone.css';
import '../../styles/job-four-stage-forms.css';
import '../../styles/job-work-mechanic-panel.css';
import '../../styles/job-work-stock-panel.css';
import '../../styles/job-work-quick-actions.css';
import { JobWorkerAssignments } from '../../components/jobs/JobWorkerAssignments';
import { JobOutsideStaffSection } from '../../components/jobs/JobOutsideStaffSection';
import { JobWorkTimerPanel } from '../../components/jobs/JobWorkTimerPanel';
import { JobWorkServiceQuickAdd } from '../../components/jobs/JobWorkServiceQuickAdd';
import { JobWorkSavedServices } from '../../components/jobs/JobWorkSavedServices';
import { totalCustomerServiceCharges } from '../../utils/jobWorkServiceCharges';
import { JobWorkStockPanel } from '../../components/jobs/JobWorkStockPanel';
import { JobTotalCostPanel } from '../../components/jobs/JobTotalCostPanel';
import { JobActivityTimeline } from '../../components/jobs/JobActivityTimeline';
import { JobWorkPhotoPanel } from '../../components/jobs/JobWorkPhotoPanel';
import { jobDisplayLabel } from '../../components/jobs/jobs.utils';
import { jobInvoiceGST, jobInvoiceFinance } from '../../utils/jobGstFinance';
import '../../styles/job-gst-finance.css';
import { JobBreadcrumbs } from '../../components/jobs/JobBreadcrumbs';
import '../../styles/jobs-unified-ui.css';
import { WhatsAppManualShareButton } from '../../components/common/WhatsAppManualShareButton';
import { statusForComplaint, complaintStatusClass, unresolvedComplaintCount, COMPLAINT_STATUSES } from '../../components/jobs/complaintStatus';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

const JOB_STATUSES = [
  'New',
  'Inspection',
  'Estimate Pending',
  'Approved',
  'In Progress',
  'Waiting for Parts',
  'QC',
  'Ready for Delivery',
  'Delivered'
];

const normalizeJobStatus = (status) => {
  if (status === 'Checked In') return 'New';
  if (status === 'Awaiting Approval') return 'Estimate Pending';
  if (status === 'Quality Check') return 'QC';
  return JOB_STATUSES.includes(status) ? status : 'New';
};

const INSPECTION_CHECKS = ['Tyres', 'Warning Lights', 'Battery', 'Engine Oil', 'Coolant', 'Brake Fluid'];

const TABS = [
  ['overview', 'Overview'],
  ['complaints', 'Complaints'],
  ['inspection', 'Inspection'],
  ['estimate', 'Estimate'],
  ['work', 'Work & Labour'],
  ['parts', 'Parts'],
  ['updates', 'Technician Updates'],
  ['qc', 'QC'],
  ['invoice', 'Invoice'],
  ['activity', 'Full Log']
];

const GUIDED_STAGES = ['overview', 'inspection', 'estimate', 'work', 'qc', 'invoice'];

const TAB_ICONS = {
  overview: Gauge,
  complaints: FileText,
  inspection: ShieldCheck,
  estimate: ReceiptText,
  work: Wrench,
  parts: PackageSearch,
  updates: History,
  qc: CheckCircle2,
  invoice: ReceiptText,
  activity: Clock3,
};

const blankFinding = () => ({
  description: '',
  severity: 'Medium',
  recommendedAction: '',
  estimatedCost: ''
});

const cleanNumber = (value) => Number(String(value ?? '').replace(/[^0-9.]/g, '')) || 0;

export function JobCardWorkspace() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { can } = useFeatureAccess();
  const hasInvoiceAccess = can('invoices.view');
  const canCreateInvoice = can('invoices.create');
  const canViewPayments = can('payments.view');
  const canCreatePayment = can('payments.create');
  const canViewGST = can('gstr.view');
  const hasStockAccess = can('stock.view');
  const workflowTabsRef = useRef(null);

  const [job, setJob] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [jobInvoices, setJobInvoices] = useState([]);
  const [jobPayments, setJobPayments] = useState([]);
  const [invoicePdfLoading, setInvoicePdfLoading] = useState(false);
  const [invoiceShareDocument, setInvoiceShareDocument] = useState(null);
  const [invoicePdfError, setInvoicePdfError] = useState('');
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [staff, setStaff] = useState([]);
  const [timerRefreshVersion, setTimerRefreshVersion] = useState(0);
  const [workQuickSection, setWorkQuickSection] = useState('service');
  const [outsideQuickToken, setOutsideQuickToken] = useState(0);
  const [stockQuickToken, setStockQuickToken] = useState(0);
  const [assignQuickToken, setAssignQuickToken] = useState(0);
  const [workSkipConfirm, setWorkSkipConfirm] = useState(false);
  const [workSkipReason, setWorkSkipReason] = useState('No Work Required');
  const [workSkipOther, setWorkSkipOther] = useState('');
  const [vehicleHistory, setVehicleHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState('');
  const [inspectionActionNotice, setInspectionActionNotice] = useState('');
  const [pdfOffer, setPdfOffer] = useState(null);
  const [pdfError, setPdfError] = useState('');
  const [pdfFilename, setPdfFilename] = useState('');
  const [approvedPdfFile, setApprovedPdfFile] = useState(null);
  const [approvedPdfSharing, setApprovedPdfSharing] = useState(false);
  const [approvedPdfNotice, setApprovedPdfNotice] = useState('');

  // Generate the approved PDF while the sheet is open. iPhone Safari's
  // native Share must receive the File synchronously on the button tap.
  useEffect(() => {
    setApprovedPdfFile(null);
    setApprovedPdfNotice('');
    setApprovedPdfSharing(false);
    if (!pdfOffer) return;
    try {
      const file = createApprovedEstimatePdfFile(pdfOffer.job, pdfOffer.estimate);
      setApprovedPdfFile(file);
      setPdfError('');
    } catch (e) {
      setPdfError(e?.message || 'Could not prepare approved estimate PDF.');
    }
  }, [pdfOffer]);

  const [complaintText, setComplaintText] = useState('');
  const [complaintFilter, setComplaintFilter] = useState('All');
  const [finding, setFinding] = useState(blankFinding());
  const [updateNote, setUpdateNote] = useState('');
  const [updateType, setUpdateType] = useState('Work Update');
  const [estimateTax, setEstimateTax] = useState('18');
  const [estimateDiscount, setEstimateDiscount] = useState('0');
  const [deliveryForm, setDeliveryForm] = useState({
    finalKm: '',
    customerSignature: '',
    warrantyNotes: ''
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'Cash'
  });
  const [feedbackRating, setFeedbackRating] = useState('');
  const [feedbackText, setFeedbackText] = useState('');

  const activeTab = useMemo(() => {
    const section = location.pathname.split('/').filter(Boolean).at(-1);
    return section === 'full-log' ? 'activity' : TABS.some(([key]) => key === section) ? section : 'overview';
  }, [location.pathname]);

  useEffect(() => {
    const rail = workflowTabsRef.current;
    const activeButton = rail?.querySelector('[aria-current="step"]');
    if (!rail || !activeButton || rail.scrollWidth <= rail.clientWidth) return;
    const left = activeButton.offsetLeft - rail.offsetLeft - (rail.clientWidth - activeButton.clientWidth) / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: 'instant' });
  }, [activeTab]);

  const loadBilling = async () => {
    if (!id) return;
    setBillingLoading(true);
    setBillingError('');
    try {
      const invoiceResponse = await billingService.list({ jobId: id });
      const allInvoices = Array.isArray(invoiceResponse) ? invoiceResponse : invoiceResponse?.results || [];
      const related = allInvoices.filter((row) =>
        (row.kind || 'invoice') === 'invoice' &&
        (String(row.jobId || row.job_id || row.sourceJobId || row.source_job_id || '') === String(id) ||
         (job?.jobNumber && String(row.jobCardNo || row.job_card_no || '') === String(job.jobNumber)))
      ).sort((a, b) => String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || '')));
      const current = related.find((row) => row.status !== 'Cancelled') || related[0];
      // Invoice read access and payment ledger read access are separate roles.
      // A job invoice must remain viewable by invoice-only staff.
      const paymentResponse = current && canViewPayments
        ? await paymentService.getPayments({ invoice: current.id }) : [];
      const allPayments = Array.isArray(paymentResponse) ? paymentResponse : paymentResponse?.results || [];
      setJobInvoices(related);
      setJobPayments(allPayments.filter((row) => String(row.invoice || '') === String(current?.id))
        .sort((a, b) => String(b.created_at || b.date || '').localeCompare(String(a.created_at || a.date || ''))));
    } catch (requestError) {
      setBillingError(requestError?.message || 'Unable to load invoice and payment records.');
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'invoice' && job?.id) loadBilling();
  }, [activeTab, job?.id, job?.jobNumber]);

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const [data, staffData, flow] = await Promise.all([
        jobService.getJobById(id),
        staffService.getStaff(),
        jobService.getJobWorkflow(id)
      ]);

      setJob(data || null);
      setWorkflow(flow || null);
      setStaff(Array.isArray(staffData) ? staffData.filter((item) => item.employmentStatus === 'Active') : []);

      if (data?.vehicleReg) {
        const history = await jobService.getVehicleHistory(data.vehicleReg);
        setVehicleHistory(history.filter((item) => item.id !== data.id));
      } else {
        setVehicleHistory([]);
      }

      setDeliveryForm({
        finalKm: data?.delivery?.finalKm ?? data?.kilometre ?? '',
        customerSignature: data?.delivery?.acknowledgedBy || '',
        warrantyNotes: data?.delivery?.warrantyNotes || data?.delivery?.notes || ''
      });
      setPaymentForm((old) => ({
        ...old,
        amount: '',
        method: data?.billing?.paymentMethod || old.method || 'Cash'
      }));
      setFeedbackRating(
        data?.customerRating || data?.customer_rating || ''
      );
      setFeedbackText(
        data?.customerFeedback || data?.customer_feedback || ''
      );
    } catch (e) {
      setError(e?.message || 'Unable to load job card.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const persist = async (patch) => {
    if (!job) return null;

    setSaving(true);
    setError('');

    try {
      const updated = await jobService.updateJob(job.id, patch);
      const next = updated || { ...job, ...patch };
      setJob(next);
      return next;
    } catch (e) {
      setError(e?.message || 'Could not save job card.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const assignTechnician = async (staffId) => {
    const selected = staff.find((item) => String(item.id) === String(staffId));

    if (USE_MOCK_API) {
      await persist({
        assignedEmployeeId: selected?.id || '',
        assignedEmployeeName: selected?.name || ''
      });
      return;
    }

    await persist({
      technician: selected?.user || null
    });
  };

  const complaintSource = job?.complaints || job?.customerComplaints || [];
  const complaints = Array.isArray(complaintSource) ? complaintSource : [];
  const pendingComplaintCount = unresolvedComplaintCount(complaints);
  const findings = job?.inspection?.findings || job?.vehicleInspection?.findings || job?.inspectionFindings || [];
  const inspectionChecks = job?.inspection?.checklist || {};
  const labourRecords = USE_MOCK_API ? (job?.labourRecords || []) : (job?.work || []);
  const customerServiceCharges = totalCustomerServiceCharges(job);
  const parts = job?.partsUsed || [];
  const outsidePurchases = job?.outsidePurchases || [];
  const estimates = (job?.estimates || [])
    .map((item) => ({
      ...item,
      approvalStatus: item.approvalStatus || (item.status === 'Draft' ? 'Pending' : item.status),
      grandTotal: item.grandTotal ?? item.total,
      taxAmount: item.taxAmount ?? item.tax,
      version: USE_MOCK_API ? item.version : 'Estimate V' + (item.version || 1)
    }))
    .sort((a, b) => String(a.created_at || a.date || '').localeCompare(String(b.created_at || b.date || '')));
  const updates = job?.workUpdates || [];
  const qc = (USE_MOCK_API ? job?.qualityCheck : job?.qc) || {
    inspector: 'Unassigned',
    status: 'Pending',
    checklist: [],
    testDriveNotes: '',
    remarks: ''
  };

  const partsTotal = useMemo(
    () => parts.reduce((sum, item) => sum + cleanNumber(item.total || cleanNumber(item.qty) * cleanNumber(item.unitPrice || item.sellingPrice)), 0),
    [parts]
  );

  const outsideTotal = useMemo(
    () => outsidePurchases.reduce((sum, item) => sum + cleanNumber(item.sellingPrice || item.purchasePrice) * cleanNumber(item.qty || 1), 0),
    [outsidePurchases]
  );

  const labourTotal = useMemo(() => {
    if (labourRecords.length) {
      return labourRecords.reduce((sum, item) => sum + cleanNumber(item.customerCharge || cleanNumber(item.hours) * cleanNumber(item.rate)), 0);
    }

    return (job?.services || []).reduce((sum, item) => sum + cleanNumber(item.labourRate) * cleanNumber(item.qty || 1), 0);
  }, [labourRecords, job?.services]);

  const estimateSubtotal = partsTotal + outsideTotal + labourTotal;
  const estimateDiscountAmount = cleanNumber(estimateDiscount);
  const taxable = Math.max(0, estimateSubtotal - estimateDiscountAmount);
  const estimateTaxAmount = taxable * cleanNumber(estimateTax) / 100;
  const estimateGrandTotal = taxable + estimateTaxAmount;

  const latestEstimate = estimates.at(-1) || null;
  const linkedInvoice = jobInvoices.find((row) => row.status !== 'Cancelled') || null;
  const financial = jobInvoiceFinance(linkedInvoice);
  const invoiceGST = jobInvoiceGST(linkedInvoice);
  const isInvoiceFinalized = financial.posted;
  const invoiceTotal = linkedInvoice
    ? cleanNumber(linkedInvoice.total)
    : (USE_MOCK_API ? cleanNumber(job?.billing?.invoiceTotal || latestEstimate?.grandTotal || 0) : 0);
  const invoicePaid = linkedInvoice ? cleanNumber(linkedInvoice.paid) : cleanNumber(job?.billing?.paidAmount || 0);
  const invoiceBalance = Math.max(0, linkedInvoice ? cleanNumber(linkedInvoice.balance ?? (invoiceTotal - invoicePaid)) : invoiceTotal - invoicePaid);
  const invoicePaymentStatus = linkedInvoice
    ? (invoiceTotal <= 0 ? 'No amount due' : invoiceBalance <= 0 ? 'Paid' : invoicePaid > 0 ? 'Partially Paid' : 'Unpaid')
    : (USE_MOCK_API ? job?.paymentStatus || 'Pending' : 'Not invoiced');


  // The backend workflow endpoint is the single source of truth for
  // persisted completion; visual checks below cover auxiliary sections only.
  const coreStages = workflow?.stages || GUIDED_STAGES;
  const coreCompleted = workflow?.completed || [];
  const inspectionWasSkipped = workflow?.inspectionStatus === 'Skipped' || job?.inspection?.status === 'Skipped';
  const estimateWasSkipped = workflow?.estimateDecision?.status === 'Skipped' || workflow?.skipped?.includes('estimate');
  const sectionComplete = {
    overview: coreCompleted.includes('overview'),
    inspection: coreCompleted.includes('inspection'),
    estimate: coreCompleted.includes('estimate'),
    work: coreCompleted.includes('work'),
    qc: coreCompleted.includes('qc'),
    invoice: coreCompleted.includes('invoice'),
    complaints: complaints.length > 0,
    parts: parts.length > 0 || outsidePurchases.length > 0,
    updates: updates.length > 0,
    activity: true
  };
  const currentStage = workflow?.current || 'overview';
  const isSectionLocked = (key) => {
    if (!workflow) return false;
    if (coreStages.includes(key)) return workflow.locked?.includes(key) || false;
    if (key === 'complaints') return false;
    if (key === 'parts') {
      // Parts can be prepared when the Estimate stage opens.
      return ['overview', 'inspection'].includes(currentStage);
    }
    if (key === 'updates') {
      return ['overview', 'inspection', 'estimate'].includes(currentStage);
    }
    return false;
  };
  // One compact main workflow for every Job Card route. Supporting sections
  // remain accessible from More without becoming required approval stages.
  const moduleTabAllowed = (key) => (key !== 'invoice' || hasInvoiceAccess) &&
    (key !== 'parts' || hasStockAccess);
  const visibleTabs = TABS.filter(([key]) => GUIDED_STAGES.includes(key) && moduleTabAllowed(key));
  const extraTabs = TABS.filter(([key]) => !GUIDED_STAGES.includes(key) && moduleTabAllowed(key));
  const activeExtraTab = extraTabs.some(([key]) => key === activeTab);
  const showWorkTools = activeTab === 'work' || (activeExtraTab && activeTab !== 'activity');
  const visibleTabIndex = visibleTabs.findIndex(([key]) => key === activeTab);
  const nextVisibleTab = visibleTabs[visibleTabIndex + 1] || null;
  const activeTabComplete = Boolean(sectionComplete[activeTab]);
  const activeTabLocked = isSectionLocked(activeTab);
  const ActiveSectionIcon = TAB_ICONS[activeTab] || FileText;
  const activeTabLabel = TABS.find(([key]) => key === activeTab)?.[1] || 'Overview';

  useEffect(() => {
    if (!job?.id || !workflow) return;
    const pieces = location.pathname.split('/').filter(Boolean);
    const requested = pieces.length > 2 ? pieces[2] : null;
    const supported = requested === 'full-log' || TABS.some(([key]) => key === requested);
    if (!supported || isSectionLocked(requested)) {
      navigate('/jobs/' + job.id + '/' + currentStage, { replace: true });
    }
  }, [job?.id, workflow, location.pathname, currentStage, navigate]);

  const refreshJobWorkflow = async (advanceFrom = null) => {
    const [updated, flow] = await Promise.all([
      jobService.getJobById(id),
      jobService.getJobWorkflow(id)
    ]);
    setJob(updated);
    setWorkflow(flow);
    if (advanceFrom && flow.current !== advanceFrom) {
      navigate('/jobs/' + id + '/' + flow.current, { replace: true });
    }
    return flow;
  };

  const completeStage = async (stage, extraOptions = {}) => {
    if (!workflow || saving) return;
    const options = { ...extraOptions };
    if (stage === 'estimate') {
      const version = options.estimateVersion ? ` V${options.estimateVersion}` : '';
      if (!await appConfirm(
        `Confirm that the customer approved this exact saved Estimate${version}? This records a staff confirmation, not a customer electronic signature.`
      )) return;
      options.approveEstimate = true;
    }
    if (stage === 'work') {
      if (!await appConfirm('Confirm all work is finished and mechanic timers are stopped?')) return;
      options.confirmWorkDone = true;
      if (pendingComplaintCount) {
        if (!await appConfirm(pendingComplaintCount + ' customer complaint(s) are unresolved. Review them before QC. Continue with an explicit unresolved-complaint acknowledgment?')) return;
        options.confirmUnresolvedComplaints = true;
      }
    }
    setSaving(true);
    setError('');
    try {
      const result = await jobService.completeJobStage(job.id, stage, options);
      if (result.job) setJob(result.job);
      setWorkflow(result);
      if (stage === 'estimate' && result.completed?.includes('estimate')) {
        // Approval must succeed on the server before a PDF can be offered.
        // Stay on Estimate until the user chooses Download or Continue.
        const approvedJob = result.job || await jobService.getJobById(job.id);
        const approvedEstimate = latestApprovedEstimate(approvedJob.estimates || []);
        if (approvedEstimate) {
          setPdfError('');
          setPdfFilename('');
          setPdfOffer({
            job: approvedJob,
            estimate: approvedEstimate,
            nextStage: result.current || 'work',
          });
        } else {
          setError('Estimate approved, but the approved PDF is not ready yet. Refresh the job card to download it.');
        }
      } else if (result.current && result.current !== stage) {
        navigate('/jobs/' + job.id + '/' + result.current, { replace: true });
      }
    } catch (e) {
      const details = e?.response?.data;
      setError(details?.delivery || details?.finalKm || details?.acknowledgedBy || details?.warrantyNotes || details?.complaints || details?.stage || details?.message || e?.message || 'Unable to complete this stage.');
    } finally {
      setSaving(false);
    }
  };

  const skipWorkStage = async (event) => {
    event.preventDefault();
    if (!job || !can('jobs.edit') || activeTab !== 'work' || currentStage !== 'work' || saving) return;
    const reason = workSkipReason === 'Other' ? workSkipOther.trim() : workSkipReason;
    if (reason.length < 3 || reason.length > 160) {
      setError('Enter a skip reason between 3 and 160 characters.');
      return;
    }
    const confirmUnresolvedComplaints = pendingComplaintCount > 0
      ? await appConfirm(pendingComplaintCount + ' customer complaint(s) are unresolved. Acknowledge and skip Work anyway?')
      : false;
    if (pendingComplaintCount && !confirmUnresolvedComplaints) return;
    setSaving(true);
    setError('');
    try {
      const result = await jobService.skipJobWork(job.id, reason, { confirmUnresolvedComplaints });
      if (result.job) setJob(result.job);
      setWorkflow(result);
      setWorkSkipConfirm(false);
      navigate('/jobs/' + job.id + '/' + (result.current || 'qc'), { replace: true });
    } catch (e) {
      const details = e?.response?.data;
      setError(details?.complaints || details?.work || details?.stage || details?.reason || details?.detail || details?.message || e?.message || 'Unable to skip Work stage.');
    } finally {
      setSaving(false);
    }
  };

  const skipEstimate = async ({ reason, details }) => {
    if (!workflow || saving || currentStage !== 'estimate') {
      throw new Error('Only an authorized user can skip the active Estimate stage.');
    }
    setSaving(true);
    setError('');
    try {
      const result = await jobService.skipJobEstimate(job.id, { reason, details });
      if (result.job) setJob(result.job);
      setWorkflow(result);
      if (result.current && result.current !== 'estimate') {
        navigate('/jobs/' + job.id + '/' + result.current, { replace: true });
      }
    } catch (error) {
      const data = error?.response?.data;
      const message = data?.estimate || data?.reason || data?.details ||
        data?.detail || error?.message || 'Unable to skip estimate.';
      setError(Array.isArray(message) ? message.join(' ') : message);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const continueAfterApproval = () => {
    if (!pdfOffer) return;
    const next = pdfOffer.nextStage;
    setPdfOffer(null);
    setPdfError('');
    setPdfFilename('');
    setApprovedPdfNotice('');
    if (next) navigate('/jobs/' + job.id + '/' + next, { replace: true });
  };

  const openApprovedPdfShare = (approvedJob, approvedEstimate) => {
    setPdfError('');
    setPdfFilename('');
    setApprovedPdfNotice('');
    setPdfOffer({ job: approvedJob, estimate: approvedEstimate, nextStage: null });
  };

  const canShareApprovedPdf = (() => {
    if (!approvedPdfFile || typeof navigator === 'undefined' ||
        typeof navigator.share !== 'function') return false;
    try {
      return typeof navigator.canShare !== 'function' ||
        navigator.canShare({ files: [approvedPdfFile] });
    } catch {
      return false;
    }
  })();

  const shareApprovedPdf = () => {
    if (!canShareApprovedPdf || approvedPdfSharing) return;
    setPdfError('');
    setApprovedPdfNotice('');
    setApprovedPdfSharing(true);
    try {
      // No await or PDF generation BEFORE navigator.share: keep user activation.
      const result = navigator.share({
        files: [approvedPdfFile],
        title: approvedPdfFile.name,
        text: 'Approved workshop estimate',
      });
      Promise.resolve(result).then(() => {
        setApprovedPdfSharing(false);
        setApprovedPdfNotice('PDF shared successfully.');
      }).catch((e) => {
        setApprovedPdfSharing(false);
        if (e?.name !== 'AbortError') {
          setPdfError(e?.message || 'Sharing failed. Please use Download PDF.');
        }
      });
    } catch (e) {
      setApprovedPdfSharing(false);
      if (e?.name !== 'AbortError') setPdfError(e?.message || 'Sharing is unavailable. Download the PDF instead.');
    }
  };

  const downloadApprovalPdf = (approvedJob, approvedEstimate) => {
    try {
      const filename = downloadApprovedEstimatePdf(approvedJob, approvedEstimate);
      setPdfError('');
      setPdfFilename(filename);
      return filename;
    } catch (e) {
      setPdfError(e?.message || 'Could not create the approved PDF.');
      return null;
    }
  };

  const addComplaint = async () => {
    const description = complaintText.trim();
    if (!description) return;

    const record = {
      id: `CMP-${Date.now()}`,
      description,
      wording: description,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    const updated = await persist({ complaints: [...complaints, record] });
    if (updated) {
      setComplaintText('');
      setComplaintFilter('All');
    }
  };

  const updateInspectionCheck = async (item, status) => {
    await persist({
      inspection: {
        ...(job.inspection || {}),
        checklist: { ...inspectionChecks, [item]: status },
      },
    });
  };

  const addFinding = async (event) => {
    event.preventDefault();
    if (!finding.description.trim()) return;

    const record = {
      id: `FND-${Date.now()}`,
      ...finding,
      estimatedCost: cleanNumber(finding.estimatedCost),
      addedToEstimate: true,
      createdAt: new Date().toISOString()
    };

    await persist({
      inspectionFindings: [...findings, record],
      status: job.status === 'New' ? 'Inspection' : job.status
    });
    setFinding(blankFinding());
  };

  const createEstimate = async (kind = 'Estimate') => {
    const nextVersion = estimates.length + 1;
    if (!USE_MOCK_API) {
      setSaving(true);
      setError('');
      try {
        await jobService.createJobEstimate(job.id, {
          version: nextVersion,
          status: 'Draft',
          items: [{ description: kind, quantity: 1 }],
          subtotal: estimateSubtotal.toFixed(2),
          tax: estimateTaxAmount.toFixed(2),
          total: estimateGrandTotal.toFixed(2)
        });
        await refreshJobWorkflow();
      } catch (e) {
        setError(e?.response?.data?.detail || e?.message || 'Estimate could not be created.');
      } finally {
        setSaving(false);
      }
      return;
    }
    const record = {
      id: `EST-${Date.now()}`,
      version: kind === 'Additional Work' ? `Additional Work V${nextVersion}` : `Estimate V${nextVersion}`,
      type: kind,
      date: new Date().toLocaleString('en-IN'),
      servicesTotal: labourTotal,
      partsTotal,
      outsidePurchasesTotal: outsideTotal,
      subtotal: estimateSubtotal,
      discount: estimateDiscountAmount,
      taxPercent: cleanNumber(estimateTax),
      taxAmount: estimateTaxAmount,
      grandTotal: estimateGrandTotal,
      approvalStatus: 'Pending',
      approvedBy: null,
      approvedAt: null
    };

    await persist({
      estimates: [...estimates, record],
      approvalStatus: 'Pending',
      status: 'Estimate Pending'
    });
  };

  const setEstimateApproval = async (estimateKey, approvalStatus) => {
    if (!USE_MOCK_API) {
      if (approvalStatus === 'Approved') return completeStage('estimate');
      setSaving(true);
      setError('');
      try {
        await jobService.rejectJobEstimate(job.id, estimateKey);
        await refreshJobWorkflow();
      } catch (e) {
        setError(e?.response?.data?.detail || e?.message || 'Estimate decision could not be saved.');
      } finally {
        setSaving(false);
      }
      return;
    }
    const nextEstimates = estimates.map((item) => (item.id || item.version) === estimateKey
      ? {
          ...item,
          approvalStatus,
          approvedBy: approvalStatus === 'Approved' ? job.customerName : null,
          approvedAt: approvalStatus === 'Approved' ? new Date().toLocaleString('en-IN') : null
        }
      : item
    );

    await persist({
      estimates: nextEstimates,
      approvalStatus,
      status: approvalStatus === 'Approved' ? 'Approved' : 'Estimate Pending'
    });
  };

  const addTechnicianUpdate = async (presetType) => {
    const note = updateNote.trim() || presetType;
    if (!note) return;

    const record = {
      id: `UPD-${Date.now()}`,
      staff: job.assignedEmployeeName || 'Current Technician',
      createdBy: job.assignedEmployeeName || 'Current Technician',
      createdAt: new Date().toISOString(),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      type: presetType || updateType,
      note,
      status: presetType === 'Work Started' ? 'In Progress' : job.status
    };

    const patch = { workUpdates: [record, ...updates] };
    if (presetType === 'Work Started' || presetType === 'Resume') patch.status = 'In Progress';
    const saved = await persist(patch);
    if (saved) setUpdateNote('');
  };

  const saveCustomerFeedback = async () => {
    const rating = Number(feedbackRating || 0);
    if (rating < 1 || rating > 5) {
      setError('Customer feedback rating must be between 1 and 5.');
      return;
    }

    const updated = await persist({
      customerRating: rating,
      customerFeedback: feedbackText.trim()
    });

    if (updated) {
      setFeedbackRating(updated.customerRating || rating);
      setFeedbackText(updated.customerFeedback || feedbackText.trim());
    }
  };

  const createInvoice = () => {
    // The invoice editor reads billable actuals from the authorized server.
    // No browser-stored snapshot, unapproved quote, purchase cost, or
    // mechanic wage can silently become customer revenue.
    navigate(`/invoices/new?kind=invoice&jobId=${encodeURIComponent(job.id)}`);
  };

  const downloadJobInvoicePdf = () => {
    if (!linkedInvoice?.id || invoicePdfLoading) return;
    setInvoicePdfError('');
    setInvoiceShareDocument(linkedInvoice);
  };

  const recordPayment = async (event) => {
    event.preventDefault();

    const paymentAmount = cleanNumber(paymentForm.amount);
    if (paymentAmount <= 0) {
      setError('Enter a valid payment amount.');
      return;
    }

    if (invoiceTotal <= 0) {
      setError('Create an estimate or invoice before recording payment.');
      return;
    }

    if (paymentAmount > invoiceBalance) {
      setError('Payment cannot exceed the outstanding invoice balance.');
      return;
    }

    // The live workshop uses the canonical Finance collection form instead
    // of this legacy demo-only shortcut. Only Finance knows the selected
    // Cash/Bank account and creates idempotent, audited ledger postings.
    if (!USE_MOCK_API) return;

    const currentPaid = cleanNumber(job.billing?.paidAmount || 0);
    const paidAmount = Math.min(invoiceTotal, currentPaid + paymentAmount);
    const outstandingBalance = Math.max(0, invoiceTotal - paidAmount);
    const paymentStatus = paidAmount <= 0
      ? 'Pending'
      : outstandingBalance <= 0
        ? 'Paid'
        : 'Partial';

    const paymentEntry = {
      id: `PAY-${Date.now()}`,
      amount: paymentAmount,
      method: paymentForm.method,
      date: new Date().toLocaleString('en-IN')
    };

    await persist({
      paymentStatus,
      billing: {
        ...(job.billing || {}),
        invoiceTotal,
        paidAmount,
        outstandingBalance,
        paymentMethod: paymentForm.method,
        payments: [paymentEntry, ...(job.billing?.payments || [])]
      }
    });

    setPaymentForm((old) => ({ ...old, amount: '' }));
  };

  const saveDelivery = async () => {
    if (!USE_MOCK_API) {
      if (!isInvoiceFinalized) {
        setError('Finalize the linked invoice before completing delivery.');
        return;
      }
      const finalKm = String(deliveryForm.finalKm ?? '').trim();
      const acknowledgedBy = String(deliveryForm.customerSignature ?? '').trim();
      const warrantyNotes = String(deliveryForm.warrantyNotes ?? '').trim();
      if (!/^\d+$/.test(finalKm) || Number(finalKm) > 2147483647 ||
          Number(finalKm) < Number(job.kilometre || 0)) {
        setError('Enter a valid final odometer reading, not less than check-in kilometres.');
        return;
      }
      if (!acknowledgedBy || acknowledgedBy.length > 160) {
        setError('Enter the customer acknowledging vehicle delivery (maximum 160 characters).');
        return;
      }
      if (warrantyNotes.length > 1500) {
        setError('Keep warranty notes within 1500 characters.');
        return;
      }
      if (!await appConfirm('Confirm the vehicle has been handed over to the customer?')) return;
      await completeStage('invoice', {
        delivery: { finalKm, acknowledgedBy, warrantyNotes }
      });
      return;
    }
    const nextDelivery = {
      ...(job.delivery || {}),
      finalKm: deliveryForm.finalKm,
      acknowledgedBy: deliveryForm.customerSignature,
      notes: deliveryForm.warrantyNotes,
      deliveryTime: new Date().toLocaleString('en-IN'),
      readyStatus: 'Delivered'
    };

    await persist({
      delivery: nextDelivery,
      status: 'Delivered'
    });
  };

  const openTab = (key) => {
    if ((key === 'invoice' && !hasInvoiceAccess) || (key === 'parts' && !hasStockAccess)) {
      setError('This module must be activated in a company Feature Label and allowed by your role.');
      return;
    }
    if (isSectionLocked(key)) {
      setError('Complete the current Job Card stage to unlock this section.');
      return;
    }
    setError('');
    navigate(`/jobs/${job.id}/${key === 'activity' ? 'full-log' : key}`);
  };

  if (loading) return <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-muted">Loading job card…</div>;
  if (!job) return (
    <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-muted" role={error ? 'alert' : undefined}>
      <p>{error || 'Job card not found.'}</p>
      {error && <button type="button" className="mt-3 rounded-lg border border-line px-4 py-2 text-content" onClick={load}>Retry</button>}
    </div>
  );

  return (
    <div className="job-management-page cg-job-detail jobs-ui-polished job-workspace-dashboard flex w-full min-w-0 flex-col gap-4 pb-4">
      <JobBreadcrumbs current={TABS.find(([key]) => key === activeTab)?.[1] || "Overview"} jobLabel={jobDisplayLabel(job)} jobId={job.id} />
      <header className="job-detail-header flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="min-w-0">
            <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-content">{jobDisplayLabel(job)}</h1>
            <p className="mt-1 text-xs text-muted">{job.vehicleReg} · {job.vehicleInfo || 'Vehicle'} · {job.customerName}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="job-overview-status-badge">{normalizeJobStatus(job.status)}</span>
          <WhatsAppManualShareButton targetType="job" targetId={job.id} />
          {hasInvoiceAccess && !isSectionLocked('invoice') && activeTab !== 'invoice' &&
            (linkedInvoice || canCreateInvoice) && (
              <button type="button" onClick={() => openTab('invoice')} className="inline-flex h-10 items-center gap-2 rounded-xl border-0 bg-primary px-4 text-xs font-bold text-white">
                <ReceiptText size={15}/>{linkedInvoice ? 'View Invoice' : 'Create Invoice'}
              </button>
            )}
        </div>
      </header>

      {can('payroll.view') && can('expenses.view') && hasStockAccess && <JobTotalCostPanel
        jobId={job.id}
        refreshVersion={timerRefreshVersion}
        refreshOnTab={activeTab}
        customerServiceCharges={customerServiceCharges}
      />}

      {activeTab !== 'overview' && activeTab !== 'activity' && !showWorkTools && (
        <>
      <div className="job-workspace-toolbar">
        <span>Current status <strong>{normalizeJobStatus(job.status)}</strong></span>
        <div className="job-workspace-toolbar-actions">
          <span className="job-workspace-lock-note"><LockKeyhole size={14} aria-hidden="true"/> Next stage unlocks on completion</span>
          <button type="button" onClick={() => setShowAdvanced((value) => !value)} aria-expanded={showAdvanced}>
            {showAdvanced ? 'Simple view' : 'Show all details'}
          </button>
        </div>
      </div>

      <section className="job-detail-summary grid grid-cols-2 gap-2 md:grid-cols-3">
        {[
          ['Customer', job.customerName || 'Walk-in'],
          ['KM', job.kilometre || '—'],
          ['Fuel', job.fuelLevel || '—'],
          ['Technician', job.assignedEmployeeName || 'Unassigned'],
          ['Estimate', latestEstimate ? money.format(latestEstimate.grandTotal || 0) : 'Not created'],
          ['Payment', job.paymentStatus || 'Pending']
        ].filter(([label]) => showAdvanced || ['Customer', 'Technician', 'Payment'].includes(label)).map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-2xl border border-line bg-surface p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
            <div className="mt-1 truncate text-sm font-extrabold text-content">{value}</div>
          </div>
        ))}
      </section>



        </>
      )}


      <div className="job-simple-step-nav" aria-label="Job Card workflow">
        <nav ref={workflowTabsRef} className="job-detail-tabs job-workflow-tabs" aria-label="Main Job Card stages">
          {visibleTabs.map(([key, label], index) => {
            const complete = Boolean(sectionComplete[key]);
            const skipped = (key === 'inspection' && inspectionWasSkipped) || (key === 'estimate' && estimateWasSkipped);
            const locked = isSectionLocked(key);
            const isActive = activeTab === key || (key === 'work' && activeExtraTab && activeTab !== 'activity' && !locked);
            return (
              <button
                type="button"
                key={key}
                onClick={() => openTab(key)}
                disabled={locked}
                aria-current={isActive ? 'step' : undefined}
                className={['job-workflow-tab', isActive ? 'is-active' : '', skipped ? 'is-skipped' : complete ? 'is-complete' : '', locked ? 'is-locked' : ''].join(' ')}
                title={locked ? label + ' – complete the previous stage first' : skipped ? label + ' skipped (not approved or completed)' : label}
              >
                <span className="job-workflow-tab-number" aria-hidden="true">{index + 1}</span>
                <span className="job-workflow-tab-label">{label}</span>
                {skipped && <span className="job-workflow-tab-skipped">Skipped</span>}
                {locked ? (
                  <LockKeyhole size={13} className="job-workflow-tab-lock" aria-label="Locked" />
                ) : skipped && !isActive ? (
                  <SkipForward size={14} className="job-workflow-tab-check" aria-label="Skipped" />
                ) : complete && !isActive ? (
                  <CheckCircle2 size={14} className="job-workflow-tab-check" aria-label="Completed" />
                ) : null}
              </button>
            );
          })}
        </nav>
        <button
          type="button"
          className={['job-full-log-tab', activeTab === 'activity' ? 'is-active' : ''].join(' ')}
          aria-current={activeTab === 'activity' ? 'page' : undefined}
          onClick={() => openTab('activity')}
          title="Full Job Card history"
        >
          <History size={16} aria-hidden="true" />
          <span>Full Log</span>
        </button>
      </div>

      {showWorkTools && (
        <div className="job-work-tools" aria-label="Work tools">
          <div className="job-work-tools-copy">
            <Wrench size={16} aria-hidden="true" />
            <span>Work tools</span>
          </div>
          <nav className="job-work-tools-actions" aria-label="Work tools sections">
            {[
              ['work', 'Work details'],
              ['complaints', 'Complaints'],
              ['parts', 'Parts'],
              ['updates', 'Technician Updates'],
            ].filter(([key]) => moduleTabAllowed(key)).map(([key, label]) => {
              const locked = isSectionLocked(key);
              const selected = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={locked}
                  onClick={() => openTab(key)}
                  aria-current={selected ? 'page' : undefined}
                  className={selected ? 'is-selected' : ''}
                  title={locked ? 'Complete the required stage first' : label}
                >
                  {label}
                  {locked && <LockKeyhole size={12} aria-label="Locked" />}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {activeTab !== 'overview' && activeTab !== 'inspection' && activeTab !== 'estimate' && (
        <>
      <section className="job-workspace-section-bar" aria-label={activeTabLabel + ' section'}>
        <div className="job-workspace-section-icon"><ActiveSectionIcon size={17} aria-hidden="true"/></div>
        <div className="job-workspace-section-title">
          <h2>{activeTabLabel}</h2>
        </div>
        {activeTab !== 'activity' && <span className={'job-workspace-section-state ' + (activeTabLocked ? 'is-locked' : activeTabComplete ? 'is-complete' : 'is-open')}>
          {activeTabLocked ? <LockKeyhole size={13} aria-hidden="true"/> : activeTabComplete ? <CheckCircle2 size={13} aria-hidden="true"/> : <Clock3 size={13} aria-hidden="true"/>}
          {activeTabLocked ? 'Locked' : activeTabComplete ? 'Complete' : 'In progress'}
        </span>}
        {!activeTabLocked && !activeTabComplete && activeTab === currentStage && activeTab === 'work' && can('jobs.edit') && (
          <button type="button" className="job-work-skip-trigger" disabled={saving}
            aria-expanded={workSkipConfirm} onClick={() => setWorkSkipConfirm((previous) => !previous)}>
            <SkipForward size={16} aria-hidden="true" /> Skip Work
          </button>
        )}
        {!activeTabLocked && !activeTabComplete && activeTab === currentStage && activeTab !== 'qc' && activeTab !== 'invoice' && (
          <button type="button" className="job-stage-complete-button" disabled={saving} onClick={() => completeStage(activeTab)}>
            <CheckCircle2 size={15} aria-hidden="true" />
            {saving ? 'Saving…' : activeTab === 'estimate' ? 'Approve & Continue' : activeTab === 'work' ? 'Finish Work & Continue' : activeTab === 'invoice' ? 'Finish Job Card' : 'Complete & Continue'}
          </button>
        )}
      </section>
      {activeTab === 'work' && currentStage === 'work' && !activeTabLocked && can('jobs.edit') && workSkipConfirm && (
        <form className="job-work-skip-confirm" onSubmit={skipWorkStage} aria-label="Confirm skip work">
          <div>
            <strong>Skip Work & continue to QC?</strong>
            <p>Only when no labour or parts were used. Existing work cannot be skipped, and QC stays required.</p>
          </div>
          <label>Reason
            <select value={workSkipReason} disabled={saving} onChange={(event) => setWorkSkipReason(event.target.value)}>
              <option value="No Work Required">No Work Required</option>
              <option value="Customer Declined Work">Customer Declined Work</option>
              <option value="Job Cancelled Before Work">Job Cancelled Before Work</option>
              <option value="Other">Other</option>
            </select>
          </label>
          {workSkipReason === 'Other' && (
            <label>Other reason
              <textarea rows={2} required maxLength={160} value={workSkipOther}
                onChange={(event) => setWorkSkipOther(event.target.value)}
                placeholder="Why was no work performed?" disabled={saving}/>
            </label>
          )}
          <div className="job-work-skip-confirm-actions">
            <button type="button" disabled={saving} onClick={() => setWorkSkipConfirm(false)}>Cancel</button>
            <button type="submit" disabled={saving || (workSkipReason === 'Other' && workSkipOther.trim().length < 3)}>
              {saving ? 'Skipping…' : 'Confirm Skip & Continue'}
            </button>
          </div>
        </form>
      )}

      {!showWorkTools && activeTab !== 'activity' && (
      <div className={'job-workflow-gate ' + (activeTabLocked ? 'is-locked' : activeTabComplete ? 'is-complete' : 'is-pending')}>
        <div>
          <strong>{activeTabLocked ? 'Stage locked' : activeTabComplete ? 'Section complete' : 'Section in progress'}</strong>
          <span>{'Complete each stage to unlock the next. Finished stages remain accessible.'}</span>
        </div>
        {nextVisibleTab && !activeTabLocked ? (
          <button type="button" disabled={saving || isSectionLocked(nextVisibleTab[0])} onClick={() => openTab(nextVisibleTab[0])}>
            Next: {nextVisibleTab[1]}
            {isSectionLocked(nextVisibleTab[0]) ? <LockKeyhole size={14} aria-hidden="true"/> : <ChevronRight size={14}/>}
          </button>
        ) : null}
      </div>
      )}

        </>
      )}

      {inspectionActionNotice && <div role="status" className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-content">{inspectionActionNotice}</div>}
      {error ? <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-600">{error}</div> : null}

      {activeTabLocked ? (
        <section className="job-workspace-locked-panel">
          <LockKeyhole size={24} aria-hidden="true" />
          <h3>{activeTabLabel} is locked</h3>
          <p>Complete the current required stage to unlock this section.</p>
          <button type="button" onClick={() => navigate('/jobs/' + job.id + '/' + currentStage, { replace: true })}>Go to current stage</button>
        </section>
      ) : (
        <>
      {activeTab === 'overview' && (
        <div className="job-overview-simple">
          <section className="job-overview-intro" aria-label="Job Card overview">
            <div className="job-overview-intro-copy">
              <span className="job-overview-eyebrow">Job Card · Step 1 of 6</span>
              <h2>Job Overview</h2>
              <p>Check the customer and vehicle details before starting inspection.</p>
            </div>
            <div className="job-overview-intro-actions">
              <button type="button" className="job-overview-secondary-action" onClick={() => setShowAdvanced((value) => !value)} aria-expanded={showAdvanced}>
                {showAdvanced ? 'Hide details' : 'More details'}
              </button>
              {sectionComplete.overview ? (
                <button type="button" className="job-overview-main-action" onClick={() => openTab(currentStage)}>
                  <CheckCircle2 size={16} aria-hidden="true" /> {currentStage === 'overview' ? 'Overview complete' : 'Go to current stage'}
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              ) : (
                <button type="button" className="job-overview-main-action" onClick={() => completeStage('overview')} disabled={saving || activeTabLocked}>
                  <CheckCircle2 size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Complete & Continue'}
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          </section>

          <div className="job-overview-primary-grid">
            <section className="job-overview-card" aria-labelledby="job-overview-customer-heading">
              <div className="job-overview-card-header">
                <span className="job-overview-card-icon"><UserRound size={18} aria-hidden="true"/></span>
                <div>
                  <h3 id="job-overview-customer-heading">Customer & Vehicle</h3>
                  <p>Basic job information</p>
                </div>
              </div>
              <dl className="job-overview-detail-grid">
                <div><dt>Customer name</dt><dd>{job.customerName || 'Not added'}</dd></div>
                <div><dt>Phone number</dt><dd>{job.customerPhone || 'Not added'}</dd></div>
                <div><dt>Vehicle number</dt><dd>{job.vehicleReg || 'Not added'}</dd></div>
                <div><dt>Make / Model</dt><dd>{job.vehicleInfo || 'Not added'}</dd></div>
                <div><dt>Service type</dt><dd>{job.serviceType || 'General Service'}</dd></div>
                <div><dt>KM Reading</dt><dd>{job.kilometre === 0 || job.kilometre ? new Intl.NumberFormat('en-IN').format(Number(job.kilometre)) + ' km' : 'Not added'}</dd></div>
                <div><dt>Fuel Level</dt><dd>{job.fuelLevel || 'Not added'}</dd></div>
                <div><dt>VIN / Chassis</dt><dd>{job.vin || job.vehicle?.vin || 'Not added'}</dd></div>
              </dl>
            </section>

            <section className="job-overview-card" aria-labelledby="job-overview-assignment-heading">
              <div className="job-overview-card-header">
                <span className="job-overview-card-icon"><Wrench size={18} aria-hidden="true"/></span>
                <div>
                  <h3 id="job-overview-assignment-heading">Mechanic Assignment</h3>
                  <p>Select who will handle this job</p>
                </div>
              </div>
              <label className="job-overview-assignment-label" htmlFor="job-overview-technician">
                Assigned mechanic
              </label>
              <select
                id="job-overview-technician"
                value={job.assignedEmployeeId || ''}
                onChange={(event) => assignTechnician(event.target.value)}
                disabled={saving}
                className="job-overview-mechanic-select"
              >
                <option value="">Choose a mechanic (optional)</option>
                {staff.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} · {item.designation || 'Workshop staff'}</option>
                ))}
              </select>
              <div className="job-overview-assignment-foot">
                <div><span>Service advisor</span><strong>{job.serviceAdvisor || 'Not assigned'}</strong></div>
                <div><span>Priority</span><strong>{job.priority || 'Medium'}</strong></div>
              </div>
              <p className="job-overview-supporting-note">You can assign or change the mechanic later.</p>
            </section>
          </div>

          <section className="job-overview-complaint" aria-label="Customer complaint">
            <div>
              <h3><FileText size={17} aria-hidden="true"/> Customer complaint</h3>
              <p>{complaints[0]?.description || complaints[0]?.wording || 'No customer complaint added yet.'}</p>
              {complaints.length > 1 && <span>{complaints.length} complaints recorded</span>}
            </div>
            <button type="button" onClick={() => openTab('complaints')}>
              {complaints.length ? 'View complaints' : 'Add complaint'} <ChevronRight size={15} aria-hidden="true"/>
            </button>
          </section>

          {showAdvanced && (
            <section className="job-overview-more" aria-label="Additional job details">
              <h3>Additional details</h3>
              <dl className="job-overview-detail-grid">
                <div><dt>Check-in</dt><dd>{job.checkInTime || job.createdDate || '—'}</dd></div>
                <div><dt>Branch</dt><dd>{job.branch || '—'}</dd></div>
                <div><dt>Estimate</dt><dd>{latestEstimate ? money.format(latestEstimate.grandTotal || 0) : 'Not created'}</dd></div>
                <div><dt>Payment</dt><dd>{job.paymentStatus || 'Pending'}</dd></div>
              </dl>
              <div className="job-overview-more-grid">
                <div className="job-overview-feedback">
                  <h4><Star size={16} aria-hidden="true"/> Customer Feedback</h4>
                  <div className="job-overview-feedback-fields">
                    <label>Rating
                      <select value={feedbackRating} onChange={(event) => setFeedbackRating(event.target.value)}>
                        <option value="">Select rating</option>
                        <option value="5">5 - Excellent</option>
                        <option value="4">4 - Very Good</option>
                        <option value="3">3 - Good</option>
                        <option value="2">2 - Fair</option>
                        <option value="1">1 - Poor</option>
                      </select>
                    </label>
                    <label>Customer comment
                      <input value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder="Customer feedback"/>
                    </label>
                    <button type="button" onClick={saveCustomerFeedback} disabled={saving || !feedbackRating}>Save Feedback</button>
                  </div>
                </div>
                <div className="job-overview-history">
                  <h4><History size={16} aria-hidden="true"/> Vehicle Service History</h4>
                  {vehicleHistory.length === 0 ? (
                    <p>No previous service records for this vehicle.</p>
                  ) : (
                    vehicleHistory.slice(0, 5).map((item) => (
                      <button key={item.id} type="button" onClick={() => navigate(`/jobs/${item.id}`)}>
                        <span><strong>{jobDisplayLabel(item)}</strong><small>{item.createdDate || 'Previous visit'}</small></span>
                        <ChevronRight size={15} aria-hidden="true"/>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {activeTab === 'complaints' && (
        <section className="job-panel job-complaints-panel" aria-label="Customer Complaints">
          <header className="job-complaints-head">
            <div className="job-complaints-title">
              <span className="job-complaints-icon" aria-hidden="true"><FileText size={18}/></span>
              <div>
                <h3>Customer Complaints</h3>
                <p>Record customer concerns and keep their progress updated.</p>
              </div>
            </div>
            <span className="job-complaints-total">{complaints.length} {complaints.length === 1 ? 'complaint' : 'complaints'}</span>
          </header>

          <div className="job-complaint-entry">
            <label htmlFor="job-customer-complaint">Add Customer Complaint</label>
            <div className="job-complaint-compose">
              <textarea
                id="job-customer-complaint"
                value={complaintText}
                onChange={(e) => setComplaintText(e.target.value)}
                placeholder="Describe the issue as explained by the customer..."
                maxLength={1000}
                rows={3}
                disabled={saving}
              />
              <button type="button" onClick={addComplaint} disabled={!complaintText.trim() || saving}>
                <Plus size={16} aria-hidden="true"/>
                {saving ? 'Saving…' : 'Add Complaint'}
              </button>
            </div>
            <div className="job-complaint-entry-footer">
              <span>Track each complaint separately. Update status from its details page.</span>
              <span>{complaintText.length}/1000</span>
            </div>
          </div>

          <div className="job-complaints-list-header">
            <div>
              <h4>Complaint Records</h4>
              <p>Staff manually update each complaint; QC does not auto-resolve issues.</p>
            </div>
            <div className="job-complaints-filters" role="group" aria-label="Filter complaints by status">
              {['All', ...COMPLAINT_STATUSES].map((filter) => {
                const count = filter === 'All'
                  ? complaints.length
                  : complaints.filter(item => statusForComplaint(item) === filter).length;
                return (
                  <button
                    type="button"
                    key={filter}
                    className={complaintFilter === filter ? 'is-active' : ''}
                    aria-pressed={complaintFilter === filter}
                    onClick={() => setComplaintFilter(filter)}
                  >
                    {filter} <span>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="job-complaint-list" aria-live="polite">
            {complaints.map((item, index) => ({ item, index })).filter(({ item }) => complaintFilter === 'All' || statusForComplaint(item) === complaintFilter).map(({ item, index }) => (
              <Link
                key={item.id || index}
                className="job-complaint-card job-complaint-card-link"
                to={`/jobs/${encodeURIComponent(job.id)}/complaints/${encodeURIComponent(item.id != null ? String(item.id) : `row-${index}`)}${location.search}`}
                aria-label={`Open complaint details: ${item.description || item.wording || `Complaint ${index + 1}`}`}
              >
                <div className="job-complaint-copy">
                  <div className="job-complaint-description">{item.description || item.wording || 'Customer complaint'}</div>
                  <p>{typeof item.relatedService === 'string' && item.relatedService.trim() ? item.relatedService : 'Customer reported issue'}</p>
                </div>
                <div className="job-complaint-actions">
                  <div className="job-complaint-status">
                    <span className="job-complaint-status-label">Status · Staff</span>
                    <span className={`job-complaint-auto-status ${complaintStatusClass(statusForComplaint(item))}`}>
                      {statusForComplaint(item)}
                    </span>
                  </div>
                  <ChevronRight size={17} aria-hidden="true" className="job-complaint-card-arrow"/>
                </div>
              </Link>
            ))}
            {complaints.length === 0 ? (
              <div className="job-complaint-empty">
                <FileText size={24} aria-hidden="true"/>
                <strong>No complaints recorded</strong>
                <p>Add a customer complaint above to start tracking it.</p>
              </div>
            ) : !complaints.some(item => complaintFilter === 'All' || statusForComplaint(item) === complaintFilter) ? (
              <div className="job-complaint-empty">
                <FileText size={24} aria-hidden="true"/>
                <strong>No {complaintFilter.toLowerCase()} complaints</strong>
                <p>Choose All to view every customer complaint.</p>
              </div>
            ) : null}
          </div>
        </section>
      )}

      {activeTab === 'inspection' && (
        <div className="job-inspection-camera-stack">
          <JobInspectionPanel
          job={job}
          canEdit={can('jobs.edit') && !activeTabLocked}
          canReopen={can('jobs.edit') && inspectionWasSkipped && currentStage === 'estimate' && !activeTabLocked}
          canCorrect={currentStage === 'estimate' && !activeTabLocked}
          startEditing={new URLSearchParams(location.search).get('edit') === '1'}
          onDoneEditing={() => navigate('/jobs/' + job.id + '/estimate')}
          onChanged={async (operation) => {
            try {
              await refreshJobWorkflow(['complete', 'skip'].includes(operation) ? 'inspection' : null);
              if (operation === 'skip') setInspectionActionNotice('Inspection skipped successfully. The Estimate stage is now available; checklist and photos were preserved.');
            } catch (e) {
              setError(e?.message || 'Could not refresh job details.');
              throw e;
            }
          }}
          />
          <VehiclePhotoGallery jobId={job.id} canEdit={can('jobs.edit')}/>
        </div>
      )}

      {activeTab === 'work' && (
        <div className="job-work-payroll-stack job-work-simple">
          <nav className="job-work-quick-actions" aria-label="Work quick actions">
            {[
              { key: 'service', label: 'Add Service', icon: Wrench },
              ...(hasStockAccess ? [{ key: 'stock', label: 'Add Spare Part', icon: PackageSearch },
                { key: 'outsidePurchase', label: 'Outside Purchase', icon: Plus }] : []),
              { key: 'mechanic', label: 'Advanced Work Tracking', icon: Clock3 },
              { key: 'assign', label: 'Assign Staff', icon: UserRound },
              { key: 'outside', label: 'Add Outside Staff', icon: Plus },
            ].map(({ key, label, icon: ActionIcon }) => (
              <button
                type="button"
                key={key}
                className={workQuickSection === key ? 'is-active' : ''}
                aria-pressed={workQuickSection === key}
                aria-controls={'work-quick-' + key}
                onClick={() => {
                  if (key === 'stock') {
                    // The stock form is always visible on Work now: this action
                    // jumps directly to it instead of hiding the other panels.
                    setStockQuickToken((value) => value + 1);
                    document.getElementById('work-quick-stock')?.scrollIntoView({
                      behavior: 'smooth', block: 'start',
                    });
                    return;
                  }
                  setWorkQuickSection(key);
                  if (key === 'outside') setOutsideQuickToken((value) => value + 1);
                  if (key === 'assign') setAssignQuickToken((value) => value + 1);
                }}
              >
                <ActionIcon size={17} aria-hidden="true"/>
                {label}
              </button>
            ))}
          </nav>

          <div id="work-quick-service" hidden={workQuickSection !== 'service'}>
            <JobWorkServiceQuickAdd
              jobId={job.id}
              staff={staff}
              canEdit={can('jobs.edit') && currentStage === 'work' && !activeTabLocked}
              onSaved={async () => {
                const updated = await jobService.getJobById(job.id);
                if (updated) setJob(updated);
                setTimerRefreshVersion((version) => version + 1);
              }}
            />
          </div>

          {hasStockAccess && workQuickSection === 'outsidePurchase' && (
            <div id="work-quick-outsidePurchase">
              <JobPartsWorkflow
                jobId={job.id}
                assignedTo={job.assignedEmployeeName || ''}
                initialPanel="outside"
              />
            </div>
          )}

          <div id="work-quick-outside" hidden={workQuickSection !== 'outside'}>
            <JobOutsideStaffSection
              jobId={job.id}
              onChanged={() => setTimerRefreshVersion((value) => value + 1)}
              quickAddToken={outsideQuickToken}
            />
          </div>

          <div id="work-quick-assign" hidden={workQuickSection !== 'assign'}>
            <JobWorkerAssignments
              key={timerRefreshVersion}
              jobId={job.id}
              staff={staff}
              focusToken={assignQuickToken}
              onChanged={() => setTimerRefreshVersion((value) => value + 1)}
            />
          </div>

          <div id="work-quick-mechanic" hidden={workQuickSection !== 'mechanic'}>
            <JobWorkTimerPanel
              jobId={job.id}
              jobStatus={normalizeJobStatus(job.status)}
              labourRecords={labourRecords}
              onChanged={() => setTimerRefreshVersion((value) => value + 1)}
            />
          </div>

          {hasStockAccess && (
            <div id="work-quick-stock">
              <JobWorkStockPanel
                jobId={job.id}
                issuedParts={job.parts || []}
                canEdit={can('jobs.edit') && currentStage === 'work' && !activeTabLocked}
                focusSearchToken={stockQuickToken}
                onChanged={async () => {
                  const updated = await jobService.getJobById(job.id);
                  if (updated) setJob(updated);
                  setTimerRefreshVersion((version) => version + 1);
                }}
              />
            </div>
          )}

          <JobWorkSavedServices
            job={job}
            canEdit={can('jobs.edit') && currentStage === 'work' && !activeTabLocked}
            onChanged={async (updated) => {
              if (updated) setJob(updated);
              else {
                const fresh = await jobService.getJobById(job.id);
                if (fresh) setJob(fresh);
              }
              setTimerRefreshVersion((version) => version + 1);
            }}
          />
        </div>
      )}

      {hasStockAccess && activeTab === 'parts' && (
        <JobPartsWorkflow
          jobId={job.id}
          assignedTo={job.assignedEmployeeName || ''}
          onJobUpdated={() => {
            setTimerRefreshVersion((value) => value + 1);
            return load();
          }}
        />
      )}

      {activeTab === 'estimate' && (
        <QuickEstimatePanel
          job={job}
          estimates={estimates}
          findings={findings}
          canEdit={can('jobs.edit') && currentStage === 'estimate' && !activeTabLocked}
          wasSkipped={estimateWasSkipped}
          canReopen={can('jobs.edit') && estimateWasSkipped && currentStage === 'work' && !activeTabLocked}
          onReopen={async () => {
            const result = await jobService.reopenJobEstimate(job.id);
            if (result.job) setJob(result.job);
            await refreshJobWorkflow();
            navigate('/jobs/' + job.id + '/estimate', { replace: true });
          }}
          onSaved={() => refreshJobWorkflow()}
          onShare={async (estimateId, action) => {
            await jobService.shareJobEstimate(job.id, estimateId, action);
            await refreshJobWorkflow();
          }}
          onApprove={(estimateId, estimateVersion) => {
            // The Job Card display labels versions "Estimate V2"; the
            // backend compares the actual immutable integer version.
            const numericVersion = Number(String(estimateVersion ?? '').replace(/^Estimate V/i, ''));
            return completeStage('estimate', {
              estimateId,
              ...(Number.isInteger(numericVersion) && numericVersion > 0
                ? { estimateVersion: numericVersion } : {}),
            });
          }}
          onSkip={skipEstimate}
          onReject={(estimateId) => setEstimateApproval(estimateId, 'Rejected')}
          onDownloadApproved={(approvedEstimate) => openApprovedPdfShare(job, approvedEstimate)}
          onEditInspection={() => navigate('/jobs/' + job.id + '/inspection?edit=1')}
          onGoToWork={() => navigate('/jobs/' + job.id + '/' + currentStage)}
        />
      )}

      {activeTab === 'updates' && (
        <section className="job-panel job-updates-panel">
          <header className="job-updates-header">
            <div>
              <h3>Technician Updates</h3>
              <p>Record repair progress, notes, work photos and image captions.</p>
            </div>
            <span className="job-updates-count">{updates.length} updates</span>
          </header>

          <div className="job-update-progress-actions" aria-label="Quick work progress">
            {['Work Started', 'Pause', 'Resume', 'Completed Work'].map((type) => (
              <button type="button" key={type} disabled={saving}
                onClick={() => addTechnicianUpdate(type)}>
                {type}
              </button>
            ))}
          </div>

          <div className="job-update-note-panel">
            <h4>Add Technician Note</h4>
            <div className="job-update-compose">
              <select aria-label="Update type" value={updateType} disabled={saving}
                onChange={(e) => setUpdateType(e.target.value)}>
                <option>Work Update</option>
                <option>Inspection</option>
                <option>Parts Update</option>
                <option>Customer Update</option>
                <option>Issue Found</option>
              </select>
              <input aria-label="Technician note" value={updateNote} disabled={saving}
                maxLength={2000} onChange={(e) => setUpdateNote(e.target.value)}
                placeholder="Enter work progress or issue details..." />
              <button type="button" disabled={!updateNote.trim() || saving}
                onClick={() => addTechnicianUpdate(updateType)}>
                {saving ? 'Saving…' : 'Add Update'}
              </button>
            </div>
          </div>

          <JobWorkPhotoPanel
            jobId={job.id}
            photos={(job.photos || []).filter((photo) => photo.photo_type !== 'inspection')}
            disabled={saving}
            onUploaded={async () => {
              const refreshed = await jobService.getJobById(job.id);
              if (refreshed) setJob(refreshed);
            }}
          />

          <section className="job-update-history" aria-label="Technician update history">
            <div className="job-update-history-heading">
              <h4>Update History</h4>
              <span>{updates.length} records</span>
            </div>
            <div className="job-update-list">
              {updates.length ? updates.map((item, index) => (
                <article key={item.id || index} className="job-update-card">
                  <div className="job-update-card-top">
                    <strong>{item.type || 'Work Update'}</strong>
                    <time>{item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : item.time || 'Recent'}</time>
                  </div>
                  <p>{item.note || 'Work status recorded'}</p>
                  <small>{item.staff || item.createdBy || 'Staff'}</small>
                </article>
              )) : (
                <div className="job-update-history-empty">
                  No technician updates yet. Add the first note above.
                </div>
              )}
            </div>
          </section>
        </section>
      )}

      {activeTab === 'qc' && (
        <JobQualityCheckPanel
          job={job}
          canEdit={currentStage === 'qc' && !activeTabLocked && !activeTabComplete}
          onSaved={() => refreshJobWorkflow()}
          onCompleted={() => refreshJobWorkflow('qc')}
        />
      )}

      {hasInvoiceAccess && activeTab === 'invoice' && (
        <div className="job-invoice-dashboard">
          <header className="job-invoice-dashboard-head">
            <div>
              <h2><ReceiptText size={18} aria-hidden="true" /> Invoice & Delivery</h2>
            </div>
            <div className="job-invoice-header-actions">
              {linkedInvoice?.id && (
                <button type="button" onClick={downloadJobInvoicePdf}
                  disabled={invoicePdfLoading || billingLoading} className="job-invoice-download-button">
                  <Download size={15} aria-hidden="true"/>
                  {invoicePdfLoading ? 'Generating PDF…' : 'Download Invoice PDF'}
                </button>
              )}
              {linkedInvoice && canViewGST && financial.gstrUrl && (
                <button type="button" className="job-gst-finance-link"
                  onClick={() => navigate(financial.gstrUrl)}>
                  <ReceiptText size={15} aria-hidden="true"/> GSTR-1
                </button>
              )}
              {linkedInvoice && canViewPayments && financial.historyUrl && (
                <button type="button" className="job-gst-finance-link"
                  onClick={() => navigate(financial.historyUrl)}>
                  <Clock3 size={15} aria-hidden="true"/> Payment History
                </button>
              )}
              {linkedInvoice && canCreatePayment && financial.paymentUrl && !USE_MOCK_API && (
                <button type="button" className="job-primary-action"
                  onClick={() => navigate(financial.paymentUrl)}>
                  <ReceiptText size={15} aria-hidden="true"/> Receive Payment
                </button>
              )}
                            {(linkedInvoice || canCreateInvoice) && <button
                type="button"
                onClick={() => linkedInvoice ? navigate('/invoices/' + linkedInvoice.id) : createInvoice()}
                className="job-primary-action"
              >
                <ReceiptText size={15} aria-hidden="true" />
                {linkedInvoice ? 'View Invoice' : 'Create Invoice'}
              </button>}
            </div>
          </header>

          <div className="job-invoice-dashboard-stats">
            {[
              ['Invoice Total', invoiceTotal, 'total'],
              ...(canViewPayments ? [
                ['Paid Amount', invoicePaid, 'paid'],
                ['Balance Due', invoiceBalance, 'balance']
              ] : [])
            ].map(([label, amount, tone]) => (
              <div className={'job-invoice-stat is-' + tone} key={label}>
                <span>{label}</span>
                <strong>{money.format(amount)}</strong>
              </div>
            ))}
            <div className="job-invoice-stat is-status">
              <span>Payment Status</span>
              <strong>{canViewPayments ? invoicePaymentStatus : 'Restricted'}</strong>
            </div>
          </div>

          {linkedInvoice && (
            <section className="job-gst-summary" aria-label="Job invoice GST and finance">
              <div className="job-gst-summary-intro">
                <h3>GST & Finance</h3>
                <p>{invoiceGST
                  ? (isInvoiceFinalized
                    ? 'GST comes from this finalized invoice, not the job estimate. Payment does not add GST again.'
                    : 'Draft GST amounts are provisional until the invoice is finalized.')
                  : linkedInvoice.invoiceType === 'gst'
                    ? 'Invoice GST snapshot is unavailable. Open the invoice to verify tax before collection.'
                    : 'Non-GST invoice. Cash/Bank collection does not add GST.'}</p>
              </div>
              {invoiceGST && <div className="job-gst-summary-values">
                <div><span>Taxable</span><strong>{money.format(invoiceGST.taxable)}</strong></div>
                <div><span>CGST</span><strong>{money.format(invoiceGST.cgst)}</strong></div>
                <div><span>SGST / UTGST</span><strong>{money.format(invoiceGST.sgst)}</strong></div>
                <div><span>IGST</span><strong>{money.format(invoiceGST.igst)}</strong></div>
                <div><span>Total GST</span><strong>{money.format(invoiceGST.tax)}</strong></div>
              </div>}
              <div className="job-gst-summary-actions">
                {canViewGST && financial.gstrUrl && <button type="button" onClick={() => navigate(financial.gstrUrl)}>
                  View in GSTR-1
                </button>}
                {canViewPayments && financial.historyUrl && <button type="button"
                  onClick={() => navigate(financial.historyUrl)}>Finance Transactions</button>}
                {canCreatePayment && financial.paymentUrl && !USE_MOCK_API && <button type="button"
                  className="is-primary" onClick={() => navigate(financial.paymentUrl)}>
                  Collect {canViewPayments ? money.format(financial.outstanding) : 'Payment'} through Cash / Bank
                </button>}
              </div>
            </section>
          )}
                    {invoicePdfError && <p role="alert" className="job-invoice-inline-message is-error">{invoicePdfError}</p>}
          {billingLoading && <p className="job-invoice-inline-message" role="status">Loading invoice and payment records…</p>}
          {billingError && <div className="job-invoice-inline-message is-error" role="alert">
            {billingError}
            <button type="button" onClick={loadBilling}>Retry</button>
          </div>}

          {linkedInvoice && !isInvoiceFinalized && <div className="job-invoice-inline-message" role="status">
             Invoice not finalized. <button type="button" onClick={() => navigate('/invoices/' + linkedInvoice.id)}>Open Invoice</button>
           </div>}
           <div className="job-invoice-dashboard-columns">
            <section className="job-panel job-invoice-billing-card">
              <div className="job-invoice-section-heading">
                <div>
                  <h3>Billing details</h3>
                  <p>{linkedInvoice ? 'Linked to the official invoice record' : 'Create an invoice to start billing this job'}</p>
                </div>
                <span className="job-invoice-status-badge">{linkedInvoice?.status || 'Not invoiced'}</span>
              </div>

              <div className="job-invoice-details">
                <div><span>Invoice Number</span><strong>{linkedInvoice?.number || (USE_MOCK_API ? job.billing?.invoiceNumber : '') || 'Not generated'}</strong></div>
                <div><span>Customer</span><strong>{job.customerName || 'Walk-in'}</strong></div>
                <div><span>Vehicle</span><strong>{job.vehicleReg || '—'}</strong></div>
                <div><span>Payment Method</span><strong>{linkedInvoice?.paymentMode || (USE_MOCK_API ? job.billing?.paymentMethod : '') || '—'}</strong></div>
              </div>

              {jobInvoices.length > 1 && (
                <div className="job-invoice-document-list">
                  <h4>Other invoices for this Job Card</h4>
                  {jobInvoices.filter((row) => row.id !== linkedInvoice?.id).map((row) => (
                    <button key={row.id} type="button" onClick={() => navigate('/invoices/' + row.id)}>
                      <span>{row.number || 'Invoice'} · {row.status}</span>
                      <strong>{money.format(cleanNumber(row.total))}</strong>
                    </button>
                  ))}
                </div>
              )}

              {(!linkedInvoice && !USE_MOCK_API) ? (
                <div className="job-invoice-empty">
                  <FileText size={20} aria-hidden="true" />
                  <strong>No invoice linked yet</strong>
                  <p>Generate an invoice from this job before recording a payment.</p>
                </div>
              ) : (!USE_MOCK_API && !isInvoiceFinalized) ? (
                <p className="job-invoice-inline-message">Finalize the linked invoice to record customer payments.</p>
              ) : (!USE_MOCK_API) ? (
                <div className="job-gst-finance-collection">
                  <strong>Customer payment · Finance ledger</strong>
                  <p>Cash/Bank account selection, partial collections, idempotency and payment audit happen in Finance. No GST is added to a receipt.</p>
                  {invoiceBalance <= 0
                    ? <p className="job-invoice-inline-message">Invoice settled. No further payment is required.</p>
                    : canCreatePayment
                      ? <button type="button" className="job-payment-submit" onClick={() => navigate(financial.paymentUrl)}>
                        Open Finance to Receive {canViewPayments ? money.format(invoiceBalance) : 'Payment'}
                      </button>
                      : <p className="job-invoice-inline-message">Only authorized Finance staff can receive payments.</p>}
                </div>
              ) : (
                <form className="job-payment-form" onSubmit={recordPayment}>
                  <div className="job-payment-form__title">Record payment</div>
                  <div className="job-payment-form__grid">
                    <label>
                      Amount (₹)
                      <input
                        inputMode="decimal"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                        placeholder="Enter amount"
                        aria-label="Payment amount"
                      />
                    </label>
                    <label>
                      Payment method
                      <select value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}>
                        <option>Cash</option><option>Card</option><option>UPI</option><option>Bank</option>
                      </select>
                    </label>
                  </div>
                  <button type="submit" disabled={saving || billingLoading || invoiceBalance <= 0} className="job-payment-submit">
                    {saving ? 'Saving…' : 'Record Payment'}
                  </button>
                </form>
              )}

              {canViewPayments && (USE_MOCK_API ? job.billing?.payments || [] : jobPayments).length > 0 && (
                <div className="job-payment-history">
                  <h4>Recent payments</h4>
                  {(USE_MOCK_API ? job.billing?.payments || [] : jobPayments).slice(0, 4).map((payment) => (
                    <div key={payment.id}>
                      <span>{payment.date || 'Payment'}</span>
                      <strong>{money.format(cleanNumber(payment.amount))} · {payment.method}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="job-panel job-invoice-delivery-card">
              <div className="job-invoice-section-heading">
                <div>
                  <h3>Vehicle delivery</h3>
                  <p>Confirm final handover details.</p>
                </div>
              </div>
              <div className="job-invoice-delivery-fields">
                <label>
                  Final KM
                  <input required inputMode="numeric" type="number" min={Number(job.kilometre || 0)} step="1" max="2147483647" disabled={normalizeJobStatus(job.status) === 'Delivered'} value={deliveryForm.finalKm} onChange={(e) => setDeliveryForm({ ...deliveryForm, finalKm: e.target.value })} placeholder="Vehicle odometer" />
                </label>
                <label>
                  Customer acknowledgement
                  <input required maxLength={160} disabled={normalizeJobStatus(job.status) === 'Delivered'} value={deliveryForm.customerSignature} onChange={(e) => setDeliveryForm({ ...deliveryForm, customerSignature: e.target.value })} placeholder="Customer name" />
                </label>
                <label>
                  Warranty / service notes
                  <textarea rows={3} maxLength={1500} disabled={normalizeJobStatus(job.status) === 'Delivered'} value={deliveryForm.warrantyNotes} onChange={(e) => setDeliveryForm({ ...deliveryForm, warrantyNotes: e.target.value })} placeholder="Handover notes" />
                </label>
                <button type="button" disabled={saving || !can('jobs.edit') || normalizeJobStatus(job.status) === 'Delivered' || (!USE_MOCK_API && !isInvoiceFinalized)} onClick={saveDelivery} className="job-invoice-deliver-button">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {normalizeJobStatus(job.status) === 'Delivered' ? 'Vehicle Delivered' : 'Complete Delivery'}
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <JobActivityTimeline jobId={job.id} />
      )}
        </>
      )}

      <ResponsiveModalSheet isOpen={Boolean(pdfOffer)}
        onClose={continueAfterApproval}
        title="Estimate Approved" maxWidth="480px">
        <div className="job-approved-pdf-offer">
          <div className="job-approved-pdf-offer-status">
            <CheckCircle2 size={22} aria-hidden="true"/>
            <div>
              <strong>Customer estimate approved</strong>
              <p>Approval is saved. Download the approved estimate PDF for your records or to share with the customer.</p>
            </div>
          </div>
          <div className="job-approved-pdf-file">
            <FileText size={22} aria-hidden="true" />
            <span>{approvedPdfFile?.name || 'Preparing approved estimate PDF…'}</span>
          </div>
          {pdfError && <p className="job-approved-pdf-error" role="alert">{pdfError}</p>}
          {approvedPdfNotice && <p className="job-approved-pdf-success" role="status">{approvedPdfNotice}</p>}
          {!canShareApprovedPdf && approvedPdfFile && (
            <p className="job-approved-pdf-hint">
              Native sharing is unavailable here. Download the PDF and share it from your device.
            </p>
          )}
          {pdfFilename && <p className="job-approved-pdf-success" role="status">PDF download started: {pdfFilename}</p>}
          <div className="job-approved-pdf-offer-actions">
            <button type="button" className="job-approved-pdf-share"
              disabled={!canShareApprovedPdf || approvedPdfSharing}
              onClick={shareApprovedPdf}>
              <Share2 size={18} aria-hidden="true"/> {approvedPdfSharing ? 'Opening share menu…' : 'Share PDF'}
            </button>
            <button type="button" className="job-approved-pdf-download"
              onClick={() => downloadApprovalPdf(pdfOffer.job, pdfOffer.estimate)}>
              <Download size={18} aria-hidden="true"/> Download PDF
            </button>
            <button type="button" className="job-approved-pdf-continue"
              onClick={continueAfterApproval}>
              {pdfOffer?.nextStage ? 'Continue to Work' : 'Close'} <ChevronRight size={16} aria-hidden="true"/>
            </button>
          </div>
        </div>
      </ResponsiveModalSheet>
      {invoiceShareDocument?.id && (
        <InvoicePdfShareSheet
          invoice={invoiceShareDocument}
          onClose={() => setInvoiceShareDocument(null)}
          onLoadingChange={setInvoicePdfLoading}
        />
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="job-info-card min-w-0 rounded-xl bg-surface-2 p-3">
      <div className="text-[10px] font-semibold text-muted">{label}</div>
      <div className="mt-1 break-words text-xs font-bold text-content">{value || '—'}</div>
    </div>
  );
}

function AmountRow({ label, value }) {
  return (
    <div className="job-amount-row flex items-center justify-between border-b border-line py-2">
      <span className="text-secondary">{label}</span>
      <strong className="text-content">{money.format(value || 0)}</strong>
    </div>
  );
}

function Empty({ text }) {
  return <div className="rounded-xl border border-dashed border-line p-5 text-center text-xs text-muted"><Clock3 size={16} className="mx-auto mb-2"/>{text}</div>;
}

export default JobCardWorkspace;
