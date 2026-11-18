import apiClient from '../api/apiClient';
import { USE_MOCK_API } from '../api/apiConfig';

const STORAGE_KEY = 'cubixgear:mock-branches';

const defaultBranches = [
  {
    id: 'BR-01',
    name: 'Main Garage Branch',
    code: 'MAIN',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: 'Kerala',
    pincode: '',
    is_head_office: true,
    is_active: true,
  },
  {
    id: 'BR-02',
    name: 'Kochi South Branch',
    code: 'KOC-S',
    phone: '',
    email: '',
    address: '',
    city: 'Kochi',
    state: 'Kerala',
    pincode: '',
    is_head_office: false,
    is_active: true,
  },
];

const readMockBranches = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(stored) && stored.length ? stored : defaultBranches;
  } catch {
    return defaultBranches;
  }
};

const writeMockBranches = (rows) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  return rows;
};

export const branchService = {
  getBranches: async () => {
    if (!USE_MOCK_API) {
      const rows = await apiClient.get('/branches/');
      return Array.isArray(rows) ? rows : rows?.results || [];
    }
    return readMockBranches();
  },

  updateBranchState: async (branchId, state) => {
    if (!branchId) throw new Error('Choose a branch to update.');
    const trimmed = String(state ?? '').trim();
    if (!trimmed) throw new Error('Select the actual branch state.');
    if (!USE_MOCK_API) {
      // Django BranchDetailView is company-scoped and admin protected.
      return apiClient.patch('/branches/' + encodeURIComponent(branchId), {
        state: trimmed,
      });
    }
    const rows = readMockBranches();
    const found = rows.find((row) => String(row.id) === String(branchId));
    if (!found) throw new Error('Branch not found.');
    const next = rows.map((row) => String(row.id) === String(branchId)
      ? { ...row, state: trimmed } : row);
    writeMockBranches(next);
    return next.find((row) => String(row.id) === String(branchId));
  },

  createBranch: async (data) => {
    if (!USE_MOCK_API) {
      return apiClient.post('/branches/', {
        name: data.name,
        code: data.code,
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        pincode: data.pincode || '',
        is_head_office: Boolean(data.is_head_office),
        is_active: true,
      });
    }

    const rows = readMockBranches();
    const created = {
      id: `BR-${Date.now()}`,
      name: data.name,
      code: data.code,
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      pincode: data.pincode || '',
      is_head_office: Boolean(data.is_head_office),
      is_active: true,
    };
    writeMockBranches([...rows, created]);
    return created;
  },
};
