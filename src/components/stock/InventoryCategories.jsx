import { useEffect, useState } from 'react';
import { Layers3, Plus } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { USE_MOCK_API } from '../../api/apiConfig';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { stockCatalogService } from '../../services/stockCatalog.service';
import '../../styles/inventory-branch-operations.css';

const rows = (result) => Array.isArray(result) ? result : result?.results || [];

export default function InventoryCategories({ onChanged }) {
  const { can } = useFeatureAccess();
  const canView = can('stock.view');
  const canCreate = can('stock.create');
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [parent, setParent] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    const found = await stockCatalogService.getCategories();
    setCategories(rows(found));
  };
  useEffect(() => {
    if (canView && !USE_MOCK_API) {
      reload().catch(() => setError('Unable to load inventory categories.'));
    }
  }, [canView]);

  const save = async (event) => {
    event.preventDefault();
    if (!canCreate || saving || USE_MOCK_API) return;
    const text = name.trim();
    if (!text || text.length > 120) {
      setError('Enter a category name (1–120 characters).'); return;
    }
    setSaving(true); setError('');
    try {
      await apiClient.post('/stock/categories', {
        name: text, parent: parent || null, is_active: true,
      });
      setName(''); setParent('');
      await reload();
      onChanged?.();
    } catch (cause) {
      const data = cause?.response?.data || cause?.data || {};
      setError(data?.name?.[0] || data?.parent?.[0] || cause?.message || 'Unable to save category.');
    } finally { setSaving(false); }
  };

  if (!canView || USE_MOCK_API) return null;
  const roots = categories.filter((item) => !item.parent && item.is_active !== false);
  return <section className="cg-branch-inventory" aria-label="Inventory categories and subcategories">
    <div className="cg-branch-heading"><div>
      <h2><Layers3 size={18} aria-hidden="true"/> Categories &amp; Subcategories</h2>
      <p>Add main categories and organize their subcategories.</p>
    </div></div>
    {error && <p className="cg-branch-error" role="alert">{error}</p>}
    {canCreate && <form onSubmit={save} className="cg-branch-form">
      <div className="cg-branch-grid">
        <label>Category Name<input required maxLength={120} value={name} disabled={saving}
          onChange={(event) => setName(event.target.value)}/></label>
        <label>Parent Category<select value={parent} disabled={saving}
          onChange={(event) => setParent(event.target.value)}>
          <option value="">Main Category</option>
          {roots.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select></label>
      </div>
      <button type="submit" disabled={saving}><Plus size={16} aria-hidden="true"/>
        {saving ? 'Saving…' : parent ? 'Add Subcategory' : 'Add Main Category'}
      </button>
    </form>}
    <div className="cg-category-tree">
      {roots.length === 0 && <p>No categories yet. Create your first main category.</p>}
      {roots.map((group) => <div className="cg-category-group" key={group.id}>
        <strong>{group.name}</strong>
        {categories.filter((child) => child.parent === group.id && child.is_active !== false).map((child) =>
          <span key={child.id}>↳ {child.name}</span>)}
      </div>)}
    </div>
  </section>;
}
