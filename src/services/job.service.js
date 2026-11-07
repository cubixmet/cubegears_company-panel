import { USE_MOCK_API } from '../api/apiConfig';
import { API_ENDPOINTS } from '../api/endpoints';
import apiClient from '../api/apiClient';
import { stockService } from './stock.service';
import {
  getMockJobs,
  getMockJobById,
  addMockJob,
  updateMockJobStatus,
  updateMockJob,
  deleteMockJob
} from '../mock/jobs.mock';

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

export const getJobs = async (params) => {
  // Staff Profile requests real assignments even when unrelated workspaces
  // have mock mode enabled; this flag is never passed to the backend.
  const { liveOnly = false, ...query } = params || {};
  if (USE_MOCK_API && !liveOnly) {
    await delay();
    let result = getMockJobs();
    if (query.status) {
      result = result.filter(j => j.status === query.status);
    }
    return Promise.resolve(result);
  }
  const response = await apiClient.get(API_ENDPOINTS.JOBS, { params: query });
  return Array.isArray(response) ? response : response?.results || [];
};

export const getJobById = async (id) => {
  if (USE_MOCK_API) {
    await delay();
    return Promise.resolve(getMockJobById(id));
  }
  return apiClient.get(`${API_ENDPOINTS.JOBS}/${id}`);
};

export const createJob = async (data) => {
  if (USE_MOCK_API) {
    await delay();
    return Promise.resolve(addMockJob(data));
  }
  return apiClient.post(API_ENDPOINTS.JOBS, data);
};

export const updateJobStatus = async (id, status) => {
  if (USE_MOCK_API) {
    await delay();
    return Promise.resolve(updateMockJobStatus(id, status));
  }
  return apiClient.patch(`${API_ENDPOINTS.JOBS}/${id}/status`, { status });
};

export const updateJob = async (id, data) => {
  if (USE_MOCK_API) {
    await delay();
    return Promise.resolve(updateMockJob(id, data));
  }
  // Job workspace saves individual sections, not a complete replacement resource.
  return apiClient.patch(`${API_ENDPOINTS.JOBS}/${id}`, data);
};

const WORKFLOW_STAGES = ['overview', 'inspection', 'estimate', 'work', 'qc', 'invoice'];
const STATUS_PROGRESS = {
  New: 0, Inspection: 1, 'Estimate Pending': 2,
  Approved: 3, 'In Progress': 3, 'Waiting for Parts': 3,
  QC: 4, 'Ready for Delivery': 5, Delivered: 6
};
const NEXT_STATUS = {
  overview: 'Inspection', inspection: 'Estimate Pending',
  estimate: 'In Progress', work: 'QC',
  qc: 'Ready for Delivery', invoice: 'Delivered'
};

const mockWorkflow = (job) => {
  const completed = WORKFLOW_STAGES.slice(0, STATUS_PROGRESS[job?.status] || 0);
  const current = WORKFLOW_STAGES.find((stage) => !completed.includes(stage)) || 'invoice';
  return {
    current,
    completed,
    locked: WORKFLOW_STAGES.slice(WORKFLOW_STAGES.indexOf(current) + 1),
    stages: WORKFLOW_STAGES,
    finished: completed.length === WORKFLOW_STAGES.length
  };
};

/** Record actual use of workshop stock directly against a Job Card.
 * Django's issue-part endpoint writes the part, movement and balance atomically.
 * Do not use generic Stock Out here: it does not create a JobPart record.
 */
export const issueJobStockPart = async (jobId, itemId, quantity) => {
  const qty = Number(quantity);
  if (!jobId || !itemId || !Number.isFinite(qty) || qty <= 0 ||
      !/^\d+(?:\.\d{1,2})?$/.test(String(quantity))) {
    throw new Error('Select a part and enter a valid quantity (maximum 2 decimal places).');
  }
  if (USE_MOCK_API) {
    const item = await stockService.getStockItemById(itemId);
    if (!item) throw new Error('Stock product not found.');
    const available = Number(item.available ?? (Number(item.onHand || 0) - Number(item.reserved || 0)));
    if (qty > available) throw new Error(`Only ${available} available.`);
    const job = getMockJobById(jobId);
    if (!job) throw new Error('Job Card not found.');
    await stockService.issueStock({
      itemId, partName: item.partName || item.name, sku: item.sku, quantity: qty, jobId,
    });
    const part = {
      id: `JOBPART-${Date.now()}`, item: itemId, itemName: item.partName || item.name,
      sku: item.sku, quantity: qty, unit_price: item.sellingPrice, issued: true,
    };
    const previousParts = job.parts || [];
    updateMockJob(jobId, {
      parts: [part, ...previousParts],
      partsUsed: [...(job.partsUsed || []), {
        id: part.id, partId: itemId, name: part.itemName, sku: part.sku,
        qty, unitPrice: Number(item.sellingPrice || 0), status: 'Issued',
      }],
    });
    return part;
  }
  return apiClient.post(`${API_ENDPOINTS.JOBS}/${jobId}/issue-part`, {
    item: itemId, quantity: qty,
  });
};

export const getJobCostSummary = async (id) => {
  if (USE_MOCK_API) {
    return {
      mechanicCost: '0.00', outsideStaffCost: '0.00', partsCost: '0.00',
      totalCost: '0.00', outsidePending: '0.00',
      unallocatedDailyWages: true, unapprovedMechanicWork: false, partsAtCurrentCost: false,
      note: 'Demo mode does not have real payment or stock cost records.'
    };
  }
  return apiClient.get(`${API_ENDPOINTS.JOBS}/${id}/cost-summary`);
};

export const uploadJobWorkPhoto = async (id, file, caption) => {
  if (USE_MOCK_API) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read the selected image.'));
      reader.readAsDataURL(file);
    });
    const job = getMockJobById(id);
    const photo = {
      id: `PH-${Date.now()}`, url: dataUrl, caption: String(caption || '').trim(),
      photo_type: 'work_update', created_at: new Date().toISOString(),
      uploaded_by: null, hasUpload: false
    };
    updateMockJob(id, { photos: [photo, ...(job?.photos || [])] });
    return photo;
  }
  const form = new FormData();
  form.append('image', file);
  form.append('caption', caption || '');
  return apiClient.post(`${API_ENDPOINTS.JOBS}/${id}/photos/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const getJobWorkPhotoBlob = async (id, photoId) => {
  if (USE_MOCK_API) throw new Error('Demo photos are already available as data URLs.');
  return apiClient.get(`${API_ENDPOINTS.JOBS}/${id}/photos/${photoId}/file`, {
    responseType: 'blob'
  });
};

export const getJobActivity = async (id) => {
  if (USE_MOCK_API) {
    const job = await getJobById(id);
    return (job?.activities || job?.timeline || []).map((row, index) => ({
      ...row,
      id: row.id || `demo-${index}`,
      event: row.event || row.title || 'Job Update',
      description: row.description || row.desc || '',
      actorName: row.actorName || 'Demo user',
      created_at: row.created_at || row.createdAt || row.time || ''
    }));
  }
  const data = await apiClient.get(`${API_ENDPOINTS.JOBS}/${id}/activity`);
  return Array.isArray(data) ? data : data?.results || [];
};

export const getJobWorkflow = async (id) => {
  if (USE_MOCK_API) return mockWorkflow(await getJobById(id));
  return apiClient.get(`${API_ENDPOINTS.JOBS}/${id}/workflow`);
};

export const completeJobStage = async (id, stage, options = {}) => {
  if (USE_MOCK_API) {
    const updated = await updateJobStatus(id, NEXT_STATUS[stage]);
    return { ...mockWorkflow(updated), job: updated };
  }
  return apiClient.post(`${API_ENDPOINTS.JOBS}/${id}/workflow`, { stage, ...options });
};

export const addJobService = async (id, values) => {
  if (USE_MOCK_API) throw new Error('Job service posting requires the live backend workflow.');
  return apiClient.post(`${API_ENDPOINTS.JOBS}/${id}/work/services`, values);
};

export const skipJobWork = async (id, reason, options = {}) => {
  const normalized = String(reason || '').trim();
  if (normalized.length < 3 || normalized.length > 160) {
    throw new Error('Enter a skip reason between 3 and 160 characters.');
  }
  if (USE_MOCK_API) {
    const job = getMockJobById(id);
    if (!job || job.status !== 'In Progress') throw new Error('Work stage is not active.');
    if ((job.work || []).length || (job.workUpdates || []).length || (job.parts || []).length) {
      throw new Error('Work has already been recorded. Finish Work instead.');
    }
    const updated = updateMockJob(id, {
      status: 'QC',
      workflow_progress: {
        ...(job.workflow_progress || {}),
        skipped: [...new Set([...(job.workflow_progress?.skipped || []), 'work'])],
        skipDetails: { ...(job.workflow_progress?.skipDetails || {}), work: { reason: normalized } },
      },
    });
    return { ...mockWorkflow(updated), skipped: ['work'], job: updated };
  }
  return apiClient.post(`${API_ENDPOINTS.JOBS}/${id}/work/skip`, { reason: normalized, ...options });
};

export const createJobEstimate = async (id, payload) => {
  if (USE_MOCK_API) throw new Error('Use existing mock estimate workflow in demo mode.');
  return apiClient.post(`${API_ENDPOINTS.JOBS}/${id}/estimates`, payload);
};

export const saveQuickJobEstimate = async (id, payload, draftId = null) => {
  if (USE_MOCK_API) {
    await delay();
    const job = getMockJobById(id);
    const existing = [...(job?.estimates || [])];
    const now = new Date().toISOString();
    const subtotal = payload.lines.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0
    );
    const discount = Number(payload.discount) || 0;
    const taxPercent = Number(payload.taxPercent) || 0;
    const tax = (subtotal - discount) * taxPercent / 100;
    const entry = {
      id: draftId || `EST-${Date.now()}`,
      version: draftId
        ? existing.find((item) => String(item.id) === String(draftId))?.version || existing.length
        : existing.length + 1,
      status: 'Draft',
      approvalStatus: 'Pending',
      items: [...payload.lines.map((item) => ({ ...item })), {
        _pricing: { taxPercent: String(taxPercent), discount: String(discount) }
      }],
      subtotal, tax, total: subtotal - discount + tax,
      created_at: now, date: now
    };
    const next = draftId
      ? existing.map((item) => String(item.id) === String(draftId) ? entry : item)
      : [...existing, entry];
    updateMockJob(id, { estimates: next, approvalStatus: 'Pending' });
    return entry;
  }
  const base = `${API_ENDPOINTS.JOBS}/${id}/estimates/quick`;
  if (!payload?.requestId || !/^[0-9a-f-]{36}$/i.test(String(payload.requestId))) {
    throw new Error('A stable request reference is required for estimate saving.');
  }
  return draftId
    ? apiClient.patch(`${base}/${draftId}`, payload)
    : apiClient.post(base, payload);
};

export const updateJobComplaintStatus = async (jobId, complaintId, { status, notes = '', workReference = '' }) => {
  if (!jobId || !complaintId) throw new Error('Choose a valid Job Card complaint.');
  if (USE_MOCK_API) throw new Error('Complaint status auditing requires the live backend.');
  return apiClient.post(
    `${API_ENDPOINTS.JOBS}/${encodeURIComponent(jobId)}/complaints/${encodeURIComponent(complaintId)}/status`,
    { status, notes, workReference }
  );
};

export const skipJobEstimate = async (id, { reason, details = '' }) => {
  if (USE_MOCK_API) throw new Error('Skip Estimate requires the live backend audit workflow.');
  return apiClient.post(`${API_ENDPOINTS.JOBS}/${id}/estimate/skip`, { reason, details });
};

export const shareJobEstimate = async (jobId, estimateId, action = 'share') => {
  if (USE_MOCK_API) throw new Error('Customer estimate sharing needs the live backend.');
  if (!jobId || !estimateId || !['share', 'withdraw'].includes(action)) {
    throw new Error('Select a valid estimate and sharing action.');
  }
  return apiClient.post(
    `${API_ENDPOINTS.JOBS}/${encodeURIComponent(jobId)}/estimates/${encodeURIComponent(estimateId)}/share`,
    { action }
  );
};

export const rejectJobEstimate = async (id, estimateId) => {
  if (USE_MOCK_API) throw new Error('Use existing mock estimate workflow in demo mode.');
  return apiClient.post(`${API_ENDPOINTS.JOBS}/${id}/estimates/${estimateId}/decision`, { decision: 'Rejected' });
};

export const deleteJob = async (id) => {
  if (USE_MOCK_API) {
    await delay();
    return Promise.resolve(deleteMockJob(id));
  }
  return apiClient.delete(`${API_ENDPOINTS.JOBS}/${id}`);
};

export const getVehicleHistory = async (registration) => {
  const normalized = String(registration || '').replace(/\s+/g, '').toLowerCase();
  if (!normalized) return [];

  const jobs = await getJobs();
  return jobs
    .filter((job) => String(job.vehicleReg || '').replace(/\s+/g, '').toLowerCase() === normalized)
    .sort((a, b) => String(b.createdDate || '').localeCompare(String(a.createdDate || '')));
};

export const jobService = {
  getJobs,
  getJobById,
  getJobCostSummary,
  issueJobStockPart,
  uploadJobWorkPhoto,
  getJobWorkPhotoBlob,
  createJob,
  updateJobStatus,
  updateJob,
  getJobWorkflow,
  getJobActivity,
  updateJobComplaintStatus,
  completeJobStage,
  skipJobWork,
  addJobService,
  createJobEstimate,
  saveQuickJobEstimate,
  skipJobEstimate,
  rejectJobEstimate,
  shareJobEstimate,
  deleteJob,
  getVehicleHistory,
  getAll: getJobs,
  getById: getJobById,
  create: createJob
};
