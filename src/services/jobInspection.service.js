import { USE_MOCK_API } from '../api/apiConfig';
import { API_ENDPOINTS } from '../api/endpoints';
import apiClient from '../api/apiClient';
import { getMockJobById, updateMockJob } from '../mock/jobs.mock';

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

export const DEFAULT_INSPECTION_CATEGORIES = [
  {
    id: 'engine',
    name: 'ENGINE',
    items: [
      'Engine condition',
      'Engine noise',
      'Engine vibration',
      'Engine oil',
      'Oil leakage',
      'Cooling system',
      'Coolant level',
      'Exhaust smoke'
    ]
  },
  {
    id: 'brakes',
    name: 'BRAKES',
    items: [
      'Brake pedal',
      'Brake pads',
      'Brake discs',
      'Brake fluid',
      'Hand brake',
      'Brake noise'
    ]
  },
  {
    id: 'steering',
    name: 'STEERING & SUSPENSION',
    items: [
      'Steering',
      'Power steering',
      'Front suspension',
      'Rear suspension',
      'Shock absorbers',
      'Wheel bearing'
    ]
  },
  {
    id: 'clutch',
    name: 'CLUTCH & TRANSMISSION',
    items: [
      'Clutch',
      'Gear shifting',
      'Gearbox',
      'Transmission oil',
      'Drive shaft'
    ]
  },
  {
    id: 'electrical',
    name: 'ELECTRICAL',
    items: [
      'Battery',
      'Alternator',
      'Starter',
      'Headlights',
      'Indicators',
      'Brake lights',
      'Horn',
      'Wipers',
      'Dashboard warning lights'
    ]
  },
  {
    id: 'ac',
    name: 'AC',
    items: [
      'AC cooling',
      'Blower',
      'Compressor',
      'Cabin filter',
      'AC noise'
    ]
  },
  {
    id: 'tyres',
    name: 'TYRES & WHEELS',
    items: [
      'Front left tyre',
      'Front right tyre',
      'Rear left tyre',
      'Rear right tyre',
      'Spare tyre',
      'Tyre pressure',
      'Wheel alignment',
      'Wheel balancing'
    ]
  },
  {
    id: 'fluids',
    name: 'FLUIDS',
    items: [
      'Engine oil',
      'Coolant',
      'Brake fluid',
      'Power steering fluid',
      'Washer fluid',
      'Transmission fluid'
    ]
  },
  {
    id: 'body',
    name: 'BODY',
    items: [
      'Front body',
      'Rear body',
      'Left side',
      'Right side',
      'Windshield',
      'Mirrors',
      'Existing dents',
      'Existing scratches'
    ]
  },
  {
    id: 'general',
    name: 'GENERAL',
    items: [
      'Fuel level',
      'Odometer',
      'Seat belts',
      'Door locks',
      'Interior condition',
      'Warning lamps'
    ]
  }
];

export const getInitialInspectionData = () => {
  const checklist = {};
  DEFAULT_INSPECTION_CATEGORIES.forEach(cat => {
    cat.items.forEach(item => {
      checklist[item] = 'Not Checked';
    });
  });

  return {
    status: 'In Progress', // Not Started | In Progress | Completed | Skipped
    technician: 'Ajmal K',
    startedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    completedAt: null,
    checklist,
    findings: [],
    diagnosticScan: {
      performed: false,
      scannerTool: 'OBD-II Launch X431 Pro',
      scanTime: null,
      technician: 'Ajmal K',
      codes: []
    },
    photos: [],
    summary: {
      totalChecks: 0,
      good: 0,
      needsAttention: 0,
      issuesFound: 0,
      criticalIssues: 0,
      recommendedRepairs: 0
    }
  };
};

export const getInspection = async (jobId) => {
  if (USE_MOCK_API) {
    await delay();
    const job = getMockJobById(jobId);
    if (!job) return null;
    if (!job.vehicleInspection) {
      const initial = getInitialInspectionData();
      if (job.inspectionFindings && job.inspectionFindings.length > 0) {
        initial.findings = job.inspectionFindings.map((f, i) => ({
          id: f.id || `FND-${i + 1}`,
          title: f.description || 'Inspection Finding',
          category: 'ENGINE',
          description: f.description || '',
          severity: f.severity || 'Medium',
          technicianFinding: f.description || '',
          recommendedAction: f.recommendedAction || '',
          estimatedLabourTime: '1.5 Hours',
          estimatedLabourCharge: 800,
          requiredParts: f.recommendedAction || '',
          estimatedPartCharge: f.estimatedCost ? Math.max(0, f.estimatedCost - 800) : 1000,
          photos: f.photo ? [f.photo] : [],
          complaintId: job.complaints?.[0]?.id || null,
          notes: 'Identified during initial check-in inspection',
          technician: 'Ajmal K',
          dateTime: new Date().toISOString().replace('T', ' ').substring(0, 16),
          addedToEstimate: !!f.addedToEstimate,
          estimateStatus: f.addedToEstimate ? 'Added to Estimate' : 'Not Added'
        }));
      }
      job.vehicleInspection = initial;
      updateMockJob(job.id, { vehicleInspection: initial });
    }
    return Promise.resolve(job.vehicleInspection);
  }
  return apiClient.get(`${API_ENDPOINTS.JOBS}/${jobId}/inspection`);
};

export const startInspection = async (jobId) => {
  if (USE_MOCK_API) {
    await delay();
    const job = getMockJobById(jobId);
    const inspection = job.vehicleInspection || getInitialInspectionData();
    inspection.status = 'In Progress';
    inspection.startedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
    updateMockJob(job.id, { vehicleInspection: inspection });
    return Promise.resolve(inspection);
  }
  return apiClient.post(`${API_ENDPOINTS.JOBS}/${jobId}/inspection/start`);
};

export const updateChecklistItem = async (jobId, itemName, status) => {
  if (USE_MOCK_API) {
    await delay();
    const job = getMockJobById(jobId);
    const inspection = job.vehicleInspection || getInitialInspectionData();
    inspection.checklist = inspection.checklist || {};
    inspection.checklist[itemName] = status;
    updateMockJob(job.id, { vehicleInspection: inspection });
    return Promise.resolve(inspection);
  }
  return apiClient.patch(`${API_ENDPOINTS.JOBS}/${jobId}/inspection/checklist`, { itemName, status });
};

export const addFinding = async (jobId, payload) => {
  if (USE_MOCK_API) {
    await delay();
    const job = getMockJobById(jobId);
    const inspection = job.vehicleInspection || getInitialInspectionData();
    const newFinding = {
      id: `FND-${Date.now()}`,
      title: payload.title || 'Vehicle Issue',
      category: payload.category || 'GENERAL',
      description: payload.description || '',
      severity: payload.severity || 'Medium',
      technicianFinding: payload.technicianFinding || payload.description || '',
      recommendedAction: payload.recommendedAction || '',
      estimatedLabourTime: payload.estimatedLabourTime || '1 Hour',
      estimatedLabourCharge: Number(payload.estimatedLabourCharge || 0),
      requiredParts: payload.requiredParts || '',
      estimatedPartCharge: Number(payload.estimatedPartCharge || 0),
      photos: payload.photos || [],
      complaintId: payload.complaintId || null,
      notes: payload.notes || '',
      technician: payload.technician || 'Ajmal K',
      dateTime: new Date().toISOString().replace('T', ' ').substring(0, 16),
      addedToEstimate: false,
      estimateStatus: 'Not Added'
    };
    inspection.findings = [newFinding, ...(inspection.findings || [])];
    updateMockJob(job.id, { vehicleInspection: inspection });
    return Promise.resolve(newFinding);
  }
  return apiClient.post(`${API_ENDPOINTS.JOBS}/${jobId}/inspection/findings`, payload);
};

export const updateFinding = async (jobId, findingId, payload) => {
  if (USE_MOCK_API) {
    await delay();
    const job = getMockJobById(jobId);
    const inspection = job.vehicleInspection || getInitialInspectionData();
    inspection.findings = (inspection.findings || []).map(f => f.id === findingId ? { ...f, ...payload } : f);
    updateMockJob(job.id, { vehicleInspection: inspection });
    return Promise.resolve(inspection);
  }
  return apiClient.put(`${API_ENDPOINTS.JOBS}/${jobId}/inspection/findings/${findingId}`, payload);
};

export const deleteFinding = async (jobId, findingId) => {
  if (USE_MOCK_API) {
    await delay();
    const job = getMockJobById(jobId);
    const inspection = job.vehicleInspection || getInitialInspectionData();
    inspection.findings = (inspection.findings || []).filter(f => f.id !== findingId);
    updateMockJob(job.id, { vehicleInspection: inspection });
    return Promise.resolve(inspection);
  }
  return apiClient.delete(`${API_ENDPOINTS.JOBS}/${jobId}/inspection/findings/${findingId}`);
};

export const addDiagnosticCode = async (jobId, payload) => {
  if (USE_MOCK_API) {
    await delay();
    const job = getMockJobById(jobId);
    const inspection = job.vehicleInspection || getInitialInspectionData();
    inspection.diagnosticScan = inspection.diagnosticScan || { performed: true, codes: [] };
    inspection.diagnosticScan.performed = true;
    inspection.diagnosticScan.scanTime = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const newCode = {
      id: `OBD-${Date.now()}`,
      code: payload.code || 'P0000',
      system: payload.system || 'Engine',
      description: payload.description || 'DTC Fault Code',
      status: payload.status || 'Active'
    };
    inspection.diagnosticScan.codes = [...(inspection.diagnosticScan.codes || []), newCode];
    updateMockJob(job.id, { vehicleInspection: inspection });
    return Promise.resolve(newCode);
  }
  return apiClient.post(`${API_ENDPOINTS.JOBS}/${jobId}/inspection/diagnostic`, payload);
};

// Image bytes are first stored by the authenticated private vehicle-photo
// endpoint. This action only links that verified file into inspection metadata.
export const addInspectionPhoto = async (jobId, { photoId } = {}) => {
  if (USE_MOCK_API) {
    throw new Error('Inspection image storage requires the real Django backend.');
  }
  if (!photoId) {
    throw new Error('Upload the photo to the private vehicle gallery before linking it.');
  }
  return apiClient.post(`${API_ENDPOINTS.JOBS}/${jobId}/inspection/photos`, { photoId });
};

/**
 * Dedicated, authenticated operation: never calls inspection/complete or
 * synthesizes Good checklist values. The server records staff, reason and time.
 */
export const skipInspection = async (jobId, reason) => {
  if (USE_MOCK_API) {
    throw new Error('Skipping inspections requires the live Django backend.');
  }
  return apiClient.post(`${API_ENDPOINTS.JOBS}/${jobId}/inspection/skip`, { reason });
};

export const completeInspection = async (jobId, needsApproval = true) => {
  if (USE_MOCK_API) {
    await delay();
    const job = getMockJobById(jobId);
    const inspection = job.vehicleInspection || getInitialInspectionData();
    inspection.status = 'Completed';
    inspection.completedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
    
    const newJobStatus = needsApproval ? 'Awaiting Approval' : job.status;
    updateMockJob(job.id, { vehicleInspection: inspection, status: newJobStatus });
    return Promise.resolve({ inspection, newJobStatus });
  }
  return apiClient.post(`${API_ENDPOINTS.JOBS}/${jobId}/inspection/complete`, { needsApproval });
};

export const addFindingToEstimate = async (jobId, findingId) => {
  if (USE_MOCK_API) {
    await delay();
    const job = getMockJobById(jobId);
    const inspection = job.vehicleInspection || getInitialInspectionData();
    const finding = (inspection.findings || []).find(f => f.id === findingId);
    if (finding) {
      finding.addedToEstimate = true;
      finding.estimateStatus = 'Added to Estimate';
      
      if (finding.estimatedLabourCharge > 0) {
        const newService = {
          id: `SRV-${Date.now()}`,
          serviceCategory: finding.category || 'Mechanical Works',
          serviceName: finding.recommendedAction || finding.title,
          qty: 1,
          labourRate: Number(finding.estimatedLabourCharge),
          assignedStaff: finding.technician || 'Ajmal K',
          estimatedDuration: finding.estimatedLabourTime || '1.5 Hours',
          status: 'Pending'
        };
        job.services = [...(job.services || []), newService];
      }

      if (finding.requiredParts && finding.estimatedPartCharge > 0) {
        const newPart = {
          id: `P-${Date.now()}`,
          partId: `STK-${Date.now().toString().slice(-4)}`,
          name: finding.requiredParts,
          sku: `SKU-${Date.now().toString().slice(-4)}`,
          qty: 1,
          unitPrice: Number(finding.estimatedPartCharge),
          total: Number(finding.estimatedPartCharge),
          status: 'Required',
          source: 'Inventory'
        };
        job.partsUsed = [...(job.partsUsed || []), newPart];
      }

      updateMockJob(job.id, { vehicleInspection: inspection, services: job.services, partsUsed: job.partsUsed });
    }
    return Promise.resolve(finding);
  }
  return apiClient.post(`${API_ENDPOINTS.JOBS}/${jobId}/inspection/findings/${findingId}/add-to-estimate`);
};

export const jobInspectionService = {
  DEFAULT_INSPECTION_CATEGORIES,
  getInspection,
  startInspection,
  updateChecklistItem,
  addFinding,
  updateFinding,
  deleteFinding,
  addDiagnosticCode,
  addInspectionPhoto,
  completeInspection,
  skipInspection,
  addFindingToEstimate
};
