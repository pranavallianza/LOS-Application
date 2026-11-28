'use client';

import { useEffect, useState } from 'react';
import { Eye, LoaderCircle, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react';
import AppShell from '../../components/AppShell';
import {
  createInterestRateMaster,
  deleteInterestRateMaster,
  getInterestRateMasters,
  getInterestRateMaster,
  getInterestRateProducts,
  updateInterestRateMaster,
} from '../../services/interestratemaster';

const getToday = () => {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};
const emptyBand = (id) => ({ id, upToAmount: '', upToMonths: '', normalInterest: '', penalRate: '', adhocRate: '' });
const initialForm = () => ({ productCode: '', productName: '', effectiveDate: getToday(), bands: [emptyBand(1)] });

function formatUpperAmount(amount) {
  if (amount === undefined || amount === null || amount === '') return '—';
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}


function validate(form, products) {
  const errors = {};
  if (!products.some((product) => product.code === form.productCode)) errors.productCode = 'Select a product code from the backend list.';
  if (form.productName.trim().length < 2 || form.productName.trim().length > 100) errors.productName = 'Enter a product name between 2 and 100 characters.';
  if (!form.effectiveDate) errors.effectiveDate = 'Select an effective date.';
  else if (form.effectiveDate < getToday()) errors.effectiveDate = 'Effective date cannot be in the past.';

  const completedBands = [];
  form.bands.forEach((band) => {
    const populated = ['upToAmount', 'upToMonths', 'normalInterest', 'penalRate', 'adhocRate']
      .some((field) => String(band[field]).trim());
    if (!populated) return;
    if (!/^\d+(\.\d{1,2})?$/.test(band.upToAmount) || Number(band.upToAmount) <= 0) {
      errors[`band-${band.id}-upToAmount`] = 'Enter an amount greater than zero with up to 2 decimal places.';
    }
    if (!/^\d+$/.test(band.upToMonths) || Number(band.upToMonths) < 1 || Number(band.upToMonths) > 480) {
      errors[`band-${band.id}-upToMonths`] = 'Enter a whole number of months from 1 to 480.';
    }
    for (const [field, label, required] of [['normalInterest', 'Normal interest', true], ['penalRate', 'Penal rate', false], ['adhocRate', 'Adhoc rate', false]]) {
      if (required && !band[field].trim()) errors[`band-${band.id}-${field}`] = `${label} is required for each rate tier.`;
      if (band[field] && (!/^\d+(\.\d{1,2})?$/.test(band[field]) || Number(band[field]) > 100)) {
        errors[`band-${band.id}-${field}`] = `${label} must be between 0 and 100%.`;
      }
    }
    if (/^\d+(\.\d{1,2})?$/.test(band.upToAmount) && /^\d+$/.test(band.upToMonths)) {
      completedBands.push({ id: band.id, amount: Number(band.upToAmount), months: Number(band.upToMonths) });
    }
  });
  if (completedBands.length === 0) errors.bands = 'Add at least one rate tier with an upper amount, upper tenure, and normal interest rate.';
  for (let index = 1; index < completedBands.length; index += 1) {
    if (completedBands[index].amount <= completedBands[index - 1].amount) {
      errors[`band-${completedBands[index].id}-upToAmount`] = 'Each amount tier must increase beyond the previous upper limit.';
    }
    if (completedBands[index].months <= completedBands[index - 1].months) {
      errors[`band-${completedBands[index].id}-upToMonths`] = 'Each tenure tier must increase beyond the previous upper limit.';
    }
  }
  return errors;
}

const styles = `
.ir-wrap{max-width:1340px;margin:0 auto;color:#263b3d}.ir-card{overflow:hidden;border:1px solid #dce6e3;border-radius:8px;background:#fff;box-shadow:0 6px 22px #193a6210}.ir-title{margin:0;padding:15px 20px;border-bottom:1px solid #e5ecea;background:#f8fbfa;color:#1c4847;text-align:center;font:700 18px Georgia,serif;text-decoration:underline}.ir-form{padding:22px 5% 24px}.ir-top-fields{display:grid;grid-template-columns:minmax(180px,.65fr) minmax(300px,1.5fr) minmax(180px,.7fr);gap:18px 26px;align-items:start;margin:0 auto 22px;max-width:1100px}.ir-field{display:grid;gap:7px;min-width:0;color:#344d4f;font-size:12px;font-weight:700}.ir-field input{width:100%;height:40px;padding:0 10px;border:1px solid #b9cbca;border-radius:4px;background:#fbfdfc;color:#263d3f;font:400 13px Arial,sans-serif;outline:none}.ir-field input:focus,.ir-cell input:focus{border-color:#177e7a;box-shadow:0 0 0 3px #177e7a19}.ir-field input[aria-invalid=true],.ir-cell input[aria-invalid=true]{border-color:#b83b3b;background:#fffafa}.ir-error{color:#b33737;font-size:10px;font-weight:500;line-height:1.4}.ir-table-wrap{overflow-x:auto;border:1px solid #c1cdcb;border-radius:3px}.ir-table{width:100%;min-width:700px;border-collapse:collapse;table-layout:fixed}.ir-table th,.ir-table td{height:49px;padding:7px 10px;border-right:1px solid #cbd4d3;border-bottom:1px solid #cbd4d3;text-align:center;color:#30474a;font-size:11px}.ir-table th{height:38px;background:#f1f5f4;font-weight:700}.ir-table tbody tr:last-child td{border-bottom:0}.ir-table th:last-child,.ir-table td:last-child{width:45px;border-right:0}.ir-table th:first-child,.ir-table td:first-child{width:65px}.ir-cell input{width:100%;height:34px;padding:0 8px;border:1px solid #c6d3d1;border-radius:3px;background:#fff;color:#2d4648;font-size:12px;text-align:center;outline:none}.ir-cell .ir-error{display:block;margin-top:4px}.ir-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px}.ir-add{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 10px;border:1px solid #ccddda;border-radius:4px;background:#f8fbfa;color:#176e67;font-size:11px;font-weight:700}.ir-add:hover{background:#eff7f5}.ir-remove{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:4px;color:#865959}.ir-remove:hover{background:#fbefef;color:#a02e2e}.ir-actions{display:flex;justify-content:center;gap:12px;margin-top:28px;padding-top:17px;border-top:1px solid #e7eeec}.ir-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:39px;padding:0 16px;border:1px solid #d0ddda;border-radius:5px;background:#fff;color:#41585a;font-size:12px;font-weight:700}.ir-btn:hover{background:#f4f8f7}.ir-submit{border-color:#177e7a;background:#177e7a;color:white}.ir-submit:hover{background:#0c6662}.ir-btn:disabled{opacity:.7;cursor:wait}.ir-message{margin:0 0 14px;padding:11px 13px;border:1px solid #c4dfd1;border-radius:5px;background:#f1faf5;color:#276b4f;font-size:12px;line-height:1.5}.ir-message.error{border-color:#e7cccc;background:#fff7f7;color:#a43838}.ir-spin{animation:ir-spin 1s linear infinite}@keyframes ir-spin{to{transform:rotate(360deg)}}
@media(max-width:850px){.ir-top-fields{grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.ir-field:nth-child(2){grid-column:1/-1;grid-row:2}}
@media(max-width:520px){.ir-form{padding:17px 14px}.ir-top-fields{grid-template-columns:1fr;gap:14px}.ir-field:nth-child(2){grid-column:auto;grid-row:auto}.ir-actions{display:grid;grid-template-columns:1fr 1fr}.ir-btn{padding:0 10px}.ir-title{font-size:16px}}
.irm-wrap{max-width:1340px;margin:0 auto;color:#263b3d}.irm-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}.irm-create{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 15px;border:1px solid #177e7a;border-radius:5px;background:#177e7a;color:#fff;font-size:12px;font-weight:700}.irm-create:hover{background:#0c6662}.irm-message{display:flex;align-items:flex-start;gap:8px;margin:0 0 14px;padding:11px 13px;border:1px solid #c4dfd1;border-radius:5px;background:#f1faf5;color:#276b4f;font-size:12px;line-height:1.5}.irm-message.error{border-color:#e7cccc;background:#fff7f7;color:#a43838}.irm-message.info{border-color:#d7e4e5;background:#f5f9f9;color:#47666a}.irm-directory{overflow:hidden;border:1px solid #dce6e3;border-radius:7px;background:#fff;box-shadow:0 5px 18px #193a620c}.irm-directory-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #e5ecea}.irm-directory-head h2{margin:0;color:#1d4143;font-size:17px}.irm-count{color:#758789;font-size:12px}.irm-list-wrap{max-width:100%;overflow:auto}.irm-list{width:100%;min-width:740px;border-collapse:collapse}.irm-list th,.irm-list td{height:54px;padding:10px 15px;border-bottom:1px solid #edf1f0;text-align:left;color:#354d4f;font-size:12px}.irm-list th{height:42px;background:#f6f9f8;color:#607577;font-size:10px;font-weight:800;text-transform:uppercase}.irm-list tbody tr:hover{background:#fbfdfc}.irm-list tbody tr:last-child td{border-bottom:0}.irm-code{color:#176e67!important;font-weight:750}.irm-actions{display:flex;justify-content:flex-end;gap:5px}.irm-icon{display:grid;place-items:center;width:33px;height:33px;border:1px solid transparent;border-radius:4px;color:#4c686a}.irm-icon:hover{border-color:#cfdfdc;background:#f2f8f6;color:#176e67}.irm-icon.danger:hover{border-color:#efd0d0;background:#fff5f5;color:#b33737}.irm-empty{padding:48px 18px!important;text-align:center!important;color:#718284!important}.irm-empty strong,.irm-empty span{display:block}.irm-empty strong{color:#355356;font-size:13px}.irm-empty span{margin-top:5px;font-size:11px}.irm-overlay{position:fixed;inset:0;z-index:20;display:grid;place-items:center;padding:20px;background:#102d35a6}.irm-dialog{display:flex;flex-direction:column;width:min(980px,100%);max-height:92vh;overflow:hidden;border:1px solid #dce6e3;border-radius:8px;background:#fff;box-shadow:0 24px 70px #0d262d40}.irm-dialog.narrow{width:min(520px,100%)}.irm-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:18px 22px;border-bottom:1px solid #e5ecea;background:#f8fbfa}.irm-dialog-head h2{margin:0;color:#1c4847;font-size:18px}.irm-dialog-head p{margin:4px 0 0;color:#718486;font-size:12px}.irm-close{display:grid;place-items:center;flex:0 0 34px;width:34px;height:34px;border:1px solid #dce6e3;border-radius:5px;color:#526a6c}.irm-close:hover{background:#eef5f3}.irm-form{overflow:auto;padding:22px}.irm-form .ir-top-fields{max-width:none;grid-template-columns:minmax(180px,.65fr) minmax(260px,1.5fr) minmax(180px,.7fr)}.irm-form .ir-table{min-width:700px}.irm-form .ir-table-wrap{max-width:100%}.irm-form .ir-actions{justify-content:flex-end;margin-top:22px}.irm-dialog-footer{display:flex;justify-content:flex-end;gap:10px;padding:13px 20px;border-top:1px solid #e7eeec}.irm-tier-view{padding:18px 22px;overflow:auto}.irm-tier-view h3{margin:0 0 12px;color:#355356;font-size:14px}.irm-tier-table{width:100%;min-width:540px;border-collapse:collapse}.irm-tier-table th,.irm-tier-table td{padding:11px 12px;border-bottom:1px solid #e8efed;text-align:left;color:#354d4f;font-size:12px}.irm-tier-table th{background:#f6f9f8;color:#607577;font-size:10px;text-transform:uppercase}.irm-tier-table td:first-child{font-weight:700}.irm-submit:disabled{cursor:wait}@media(max-width:700px){.irm-heading{align-items:stretch;flex-direction:column}.irm-create{width:100%}.irm-form .ir-top-fields{grid-template-columns:1fr}.irm-form .ir-field:nth-child(2){grid-column:auto;grid-row:auto}.irm-dialog{max-height:96vh}.irm-dialog-head{padding:15px 16px}.irm-form{padding:16px}.irm-dialog-footer{padding:12px 16px}.irm-dialog-footer .ir-btn{flex:1}.irm-directory-head{padding:14px}.irm-tier-view{padding:14px 16px}}
`;

export default function InterestRateMasterPage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [masters, setMasters] = useState([]);
  const [loadingMasters, setLoadingMasters] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadMasters() {
      setLoadingMasters(true);
      try {
        const rows = await getInterestRateMasters({ page: 0, size: 100, signal: controller.signal });
        if (!controller.signal.aborted) setMasters(rows);
      } catch (error) {
        if (!controller.signal.aborted) {
          setMessage({ type: 'error', text: error.message || 'Unable to load interest rate masters.' });
        }
      } finally {
        if (!controller.signal.aborted) setLoadingMasters(false);
      }
    }

    loadMasters();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        const rows = await getInterestRateProducts(controller.signal);
        if (!controller.signal.aborted) {
          setProducts(rows.filter((product) => product.code && product.name));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setMessage({ type: 'error', text: error.message || 'Unable to load products from the backend.' });
        }
      } finally {
        if (!controller.signal.aborted) setProductsLoading(false);
      }
    }

    loadProducts();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!products.length) return;
    setMasters((current) => current.map((master) => {
      const product = products.find((item) => item.code.toLowerCase() === master.productCode.toLowerCase());
      return product ? { ...master, productName: master.productName || product.name } : master;
    }));
  }, [products]);

  function openCreate() {
    setForm(initialForm());
    setErrors({});
    setMessage(null);
    setProductSearch('');
    setProductPickerOpen(false);
    setDialog({ type: 'form' });
  }

  function updateHeader(field, value) {
    const selectedProduct = field === 'productCode'
      ? products.find((product) => product.code === value)
      : null;
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'productCode' ? { productName: selectedProduct?.name || '' } : {})
    }));
    setErrors((current) => ({ ...current, [field]: '', ...(field === 'productCode' ? { productName: '' } : {}) }));
    setMessage(null);
  }

  function selectProduct(product) {
    updateHeader('productCode', product.code);
    setProductPickerOpen(false);
    setProductSearch('');
  }

  const productSearchRows = products.map((product) => ({
    ...product,
    effectiveDates: masters
      .filter((master) => master.productCode.toLowerCase() === product.code.toLowerCase())
      .map((master) => master.effectiveDate)
      .filter(Boolean)
      .sort((left, right) => right.localeCompare(left))
  }));
  const filteredProducts = productSearchRows.filter((product) => (
    `${product.code} ${product.name} ${product.effectiveDates.join(' ')}`.toLowerCase().includes(productSearch.trim().toLowerCase())
  ));
  function updateBand(id, field, value) {
    setForm((current) => ({ ...current, bands: current.bands.map((band) => band.id === id ? { ...band, [field]: value } : band) }));
    setErrors((current) => ({ ...current, [`band-${id}-${field}`]: '', bands: '' }));
    setMessage(null);
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = validate(form, products);
    setErrors(nextErrors);
    const invalid = Object.keys(nextErrors)[0];
    if (invalid) {
      document.getElementById(`ir-${invalid}`)?.focus();
      return;
    }

    if (masters.some((master) => (
      master.productCode.toLowerCase() === form.productCode.trim().toLowerCase()
      && master.effectiveDate === form.effectiveDate
      && master.id !== dialog.master?.id
    ))) {
      setErrors((current) => ({ ...current, effectiveDate: 'A master already exists for this product and effective date. Choose a different date.' }));
      document.getElementById('ir-effectiveDate')?.focus();
      return;
    }

    const existingMaster = dialog.master;
    const master = {
      id: existingMaster?.id || globalThis.crypto?.randomUUID?.() || `rate-master-${Date.now()}`,
      productCode: form.productCode.trim(),
      productName: form.productName.trim(),
      effectiveDate: form.effectiveDate,
      bands: form.bands.filter((band) => band.upToAmount !== '' && band.upToMonths !== '' && band.normalInterest !== '').map((band, index) => ({ ...band, id: index + 1 })),
      updatedAt: new Date().toISOString()
    };

    setSaving(true);
    try {
      const payload = {
        productCode: master.productCode,
        effectiveDate: master.effectiveDate,
        tiers: master.bands.map((band) => ({
          upToAmount: Number(band.upToAmount),
          upToMonths: Number(band.upToMonths),
          normalRate: Number(band.normalInterest),
          penalRate: band.penalRate === '' || band.penalRate == null ? null : Number(band.penalRate),
          adhocRate: band.adhocRate === '' || band.adhocRate == null ? null : Number(band.adhocRate)
        }))
      };
      payload.tiers.sort((left, right) => left.upToAmount - right.upToAmount || left.upToMonths - right.upToMonths);
      const result = existingMaster
        ? await updateInterestRateMaster(existingMaster.id, payload)
        : await createInterestRateMaster(payload);
      const savedMaster = {
        ...master,
        ...result.data,
        productCode: result.data?.productCode || master.productCode,
        productName: master.productName,
        effectiveDate: result.data?.effectiveDate || master.effectiveDate,
        bands: result.data?.bands?.length ? result.data.bands : master.bands,
      };
      const nextMasters = existingMaster
        ? masters.map((record) => record.id === existingMaster.id ? savedMaster : record)
        : [savedMaster, ...masters];
      setMasters(nextMasters);
      setDialog(null);
      setMessage({
        type: 'success',
        text: existingMaster
          ? 'Interest rate master updated successfully.'
          : result.result?.message || 'Interest rate master saved successfully.'
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to save interest rates.' });
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setForm(initialForm());
    setErrors({});
    setMessage(null);
    setDialog(null);
  }

  async function openEdit(master) {
    setSaving(true);
    try {
      const details = await getInterestRateMaster(master.id);
      const selected = details || master;
      setForm({
        productCode: selected.productCode,
        productName: selected.productName || master.productName,
        effectiveDate: selected.effectiveDate,
        bands: selected.bands.map((band) => ({ ...band }))
      });
      setErrors({});
      setMessage(null);
      setDialog({ type: 'form', master: selected });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to load the interest rate master.' });
    } finally {
      setSaving(false);
    }
  }

  async function openView(master) {
    setSaving(true);
    try {
      const details = await getInterestRateMaster(master.id);
      setDialog({ type: 'view', master: details || master });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to load the interest rate master.' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteMaster(master) {
    setSaving(true);
    try {
      await deleteInterestRateMaster(master.id);
      setMasters((current) => current.filter((record) => record.id !== master.id));
      setDialog(null);
      setMessage({ type: 'success', text: 'Interest rate master deleted successfully.' });
    } catch (error) {
      setDialog(null);
      setMessage({ type: 'error', text: error.message || 'Unable to delete the interest rate master.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="">
      <style>{styles}</style>
      <style>{`
        .irm-create:disabled{opacity:.65;cursor:not-allowed}
        .irm-form .ir-top-fields{grid-template-columns:repeat(3,minmax(0,1fr))}
        .irm-form .ir-field select{box-sizing:border-box;width:100%;height:40px;padding:0 10px;border:1px solid #b9cbca;border-radius:4px;background:#fbfdfc;color:#263d3f;font:400 13px Arial,sans-serif}
        .irm-form .ir-field select:focus{border-color:#177e7a;box-shadow:0 0 0 3px #177e7a19;outline:none}
        .irm-form .ir-field input[readonly]{background:#f2f6f5;color:#52686a;cursor:default}
        .irm-product-control{display:flex;gap:8px;min-width:0}
        .irm-product-control input{min-width:0;flex:1}
        .irm-product-search{display:grid;place-items:center;flex:0 0 40px;height:40px;border:1px solid #b9cbca;border-radius:4px;background:#fff;color:#176e67}
        .irm-product-search:hover:not(:disabled){border-color:#177e7a;background:#f2f8f6}
        .irm-product-search:disabled{opacity:.55;cursor:not-allowed}
        .irm-picker-overlay{z-index:30}
        .irm-picker{width:min(680px,100%)}
        .irm-picker-content{display:flex;flex-direction:column;min-height:0;padding:18px 22px}
        .irm-picker-search{position:relative;margin-bottom:14px}
        .irm-picker-search svg{position:absolute;top:50%;left:12px;transform:translateY(-50%);color:#718486}
        .irm-picker-search input{box-sizing:border-box;width:100%;height:42px;padding:0 12px 0 38px;border:1px solid #b9cbca;border-radius:5px;color:#263d3f;font:400 13px Arial,sans-serif}
        .irm-picker-search input:focus{border-color:#177e7a;box-shadow:0 0 0 3px #177e7a19;outline:none}
        .irm-picker-results{max-height:min(420px,55vh);overflow:auto;border:1px solid #e1e9e7;border-radius:5px}
        .irm-picker-table{width:100%;border-collapse:collapse}
        .irm-picker-table th,.irm-picker-table td{padding:11px 14px;border-bottom:1px solid #edf1f0;text-align:left;color:#354d4f;font-size:12px}
        .irm-picker-table th{position:sticky;top:0;background:#f6f9f8;color:#607577;font-size:10px;text-transform:uppercase}
        .irm-picker-table tbody tr:last-child td{border-bottom:0}
        .irm-picker-table tbody tr:hover{background:#f5faf8}
        .irm-picker-code{color:#176e67!important;font-weight:700}
        .irm-picker-select{padding:6px 10px;border:1px solid #d0ddda;border-radius:4px;background:#fff;color:#176e67;font-size:11px;font-weight:700}
        .irm-picker-select:hover{border-color:#177e7a;background:#f2f8f6}
        .irm-picker-select:disabled{border-color:#e1e9e7;background:#f6f9f8;color:#849294;cursor:not-allowed}
        .irm-picker-samples td{background:#fbfcfc;color:#849294}
        .irm-picker-sample-note{margin:0 0 10px;color:#718486;font-size:11px;line-height:1.5}
        .irm-picker-empty{padding:32px 16px!important;text-align:center!important;color:#718284!important}
        @media(max-width:520px){.irm-picker-content{padding:14px}.irm-picker-table th,.irm-picker-table td{padding:10px 9px}}
        .irm-form .ir-table{min-width:900px}
        .irm-form .ir-table th:last-child,.irm-form .ir-table td:last-child{width:auto;border-right:0}
        .ir-tier-index{display:flex;align-items:center;justify-content:center;gap:4px}
        .ir-remove:disabled{opacity:.35;cursor:not-allowed}
        .irm-list{min-width:1050px}
        @media(max-width:850px){.irm-form .ir-top-fields{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:520px){.irm-form .ir-top-fields{grid-template-columns:1fr}}
      `}</style>
      <main className="irm-wrap">
        <div className="irm-heading">
          <div style={{ marginTop: '-15px', marginBottom: '26px' }}>
            <h1 style={{ margin: 0, color: '#23474C', font: '700 23px Manrope' }}>
              Interest Rate Master
            </h1>
            <div className="page-header-marquee" role="note" aria-label="Set effective-dated interest tiers by loan product and tenure.">
              <div className="page-header-marquee-window" aria-hidden="true">
                <div className="page-header-marquee-track">
                  <span>Set effective-dated interest tiers by loan product and tenure.</span>
                </div>
              </div>
            </div>
          </div>
          <button className="irm-create" type="button" onClick={openCreate}><Plus size={16} /> Create interest rate master</button>
        </div>
        {message && !dialog && <div className={`irm-message ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</div>}
        <section className="irm-directory" aria-labelledby="irm-directory-title">
          <div className="irm-directory-head"><h2 id="irm-directory-title">Interest rate masters</h2><span className="irm-count">{loadingMasters ? 'Loading...' : `${masters.length} ${masters.length === 1 ? 'master' : 'masters'}`}</span></div>
          <div className="irm-list-wrap">
            <table className="irm-list">
              <thead><tr><th scope="col">Product code</th><th scope="col">Product name</th><th scope="col">Effective date</th><th scope="col">Up to amount</th><th scope="col">Up to months</th><th scope="col">Normal interest</th><th scope="col">Penal rate</th><th scope="col">Adhoc rate</th><th scope="col">Actions</th></tr></thead>
              <tbody>
                {masters.map((master) => (
                  <tr key={master.id}>
                    <td className="irm-code">{master.productCode}</td>
                    <td>{master.productName}</td>
                    <td>{master.effectiveDate}</td>
                    <td>{master.bands.map((band) => formatUpperAmount(band.upToAmount)).join(' · ')}</td>
                    <td>{master.bands.map((band) => `${band.upToMonths || '—'} mo`).join(' · ')}</td>
                    <td>{master.bands.map((band) => `${band.normalInterest}%`).join(' · ')}</td>
                    <td>{master.bands.map((band) => band.penalRate !== '' && band.penalRate != null ? `${band.penalRate}%` : '—').join(' · ')}</td>
                    <td>{master.bands.map((band) => band.adhocRate !== '' && band.adhocRate != null ? `${band.adhocRate}%` : '—').join(' · ')}</td>
                    <td><div className="irm-actions">
                      <button className="irm-icon" type="button" onClick={() => openView(master)} aria-label={`View ${master.productName}`} title="View" disabled={saving}><Eye size={16} /></button>
                      <button className="irm-icon" type="button" onClick={() => openEdit(master)} aria-label={`Edit ${master.productName}`} title="Edit" disabled={saving}><Pencil size={16} /></button>
                      <button className="irm-icon danger" type="button" onClick={() => setDialog({ type: 'delete', master })} aria-label={`Delete ${master.productName}`} title="Delete" disabled={saving}><Trash2 size={16} /></button>
                    </div></td>
                  </tr>
                ))}
                {!loadingMasters && masters.length === 0 && <tr><td className="irm-empty" colSpan="9"><strong>No interest rate masters yet</strong><span>Create a master to manage product rates and tenure tiers.</span></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {dialog?.type === 'form' && (
        <div className="irm-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) reset(); }}>
          <section className="irm-dialog" role="dialog" aria-modal="true" aria-labelledby="irm-form-title">
            <header className="irm-dialog-head"><div><h2 id="irm-form-title">{dialog.master ? 'Edit interest rate master' : 'Create interest rate master'}</h2><p>Choose a backend product, set the effective date, and define its rate details.</p></div><button className="irm-close" type="button" onClick={reset} disabled={saving} aria-label="Close form"><X size={18} /></button></header>
            {message?.type === 'error' && <div className="irm-message error" role="alert">{message.text}</div>}
            <form className="ir-form irm-form" onSubmit={submit} noValidate>
              <div className="ir-top-fields">
                <div className="ir-field">
                  <label htmlFor="ir-productCode">Product Code *</label>
                  <div className="irm-product-control">
                    <input id="ir-productCode" value={form.productCode} placeholder="Search and select a product" readOnly aria-readonly="true" aria-haspopup="dialog" aria-required="true" aria-invalid={Boolean(errors.productCode)} aria-describedby={errors.productCode ? 'ir-productCode-error' : undefined} onClick={() => { setProductSearch(''); setProductPickerOpen(true); }} />
                    <button className="irm-product-search" type="button" aria-label="Search products" title="Search products" onClick={() => { setProductSearch(''); setProductPickerOpen(true); }}>
                      <Search size={17} />
                    </button>
                  </div>
                  {errors.productCode && <small className="ir-error" id="ir-productCode-error">{errors.productCode}</small>}
                </div>
                <label className="ir-field" htmlFor="ir-productName">
                  Product Name *
                  <input id="ir-productName" value={form.productName} readOnly aria-readonly="true" aria-required="true" aria-invalid={Boolean(errors.productName)} aria-describedby={errors.productName ? 'ir-productName-error' : undefined} />
                  {errors.productName && <small className="ir-error" id="ir-productName-error">{errors.productName}</small>}
                </label>
                <label className="ir-field" htmlFor="ir-effectiveDate">
                  Effective Date *
                  <input id="ir-effectiveDate" value={form.effectiveDate} onChange={(event) => updateHeader('effectiveDate', event.target.value)} type="date" min={getToday()} aria-required="true" aria-invalid={Boolean(errors.effectiveDate)} aria-describedby={errors.effectiveDate ? 'ir-effectiveDate-error' : undefined} />
                  {errors.effectiveDate && <small className="ir-error" id="ir-effectiveDate-error">{errors.effectiveDate}</small>}
                </label>
              </div>
              <div className="ir-table-wrap">
                <table className="ir-table">
                  <thead><tr><th>Sr.</th><th>Up to Amount (₹)</th><th>Up to Months</th><th>Normal Int. %</th><th>Penal Rate %</th><th>Adhoc Rate %</th></tr></thead>
                  <tbody>
                    {form.bands.map((band, index) => (
                      <tr key={band.id}>
                        <td>{index + 1}</td>
                        {[
                          ['upToAmount', 'Amount upper limit in rupees'], ['upToMonths', 'Tenure upper limit in months'], ['normalInterest', 'Normal interest rate'], ['penalRate', 'Penal rate'], ['adhocRate', 'Adhoc rate']
                        ].map(([field, label]) => {
                          const errorKey = `band-${band.id}-${field}`;
                          const isAmountOrMonths = ['upToAmount', 'upToMonths'].includes(field);
                          return (
                            <td className="ir-cell" key={field}>
                              <input id={`ir-${errorKey}`} aria-label={`${label}, tier ${index + 1}`} type="number" min={field === 'upToAmount' ? '0.01' : field === 'upToMonths' ? '1' : '0'} max={field === 'upToMonths' ? '480' : !isAmountOrMonths ? '100' : undefined} step={field === 'upToMonths' ? '1' : '0.01'} inputMode={field === 'upToMonths' ? 'numeric' : 'decimal'} value={band[field]} onChange={(event) => updateBand(band.id, field, event.target.value)} aria-invalid={Boolean(errors[errorKey])} aria-describedby={errors[errorKey] ? `ir-${errorKey}-error` : undefined} />
                              {errors[errorKey] && <small className="ir-error" id={`ir-${errorKey}-error`}>{errors[errorKey]}</small>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {errors.bands && <p className="ir-error" role="alert">{errors.bands}</p>}
              <div className="ir-tools"><span className="ir-error">One rate tier is allowed for each product.</span></div>
              <div className="ir-actions"><button className="ir-btn" type="button" onClick={reset} disabled={saving}>Cancel</button><button className="ir-btn ir-submit" type="submit" disabled={saving}>{saving ? <LoaderCircle className="ir-spin" size={15} /> : <Save size={15} />}{saving ? 'Saving...' : dialog.master ? 'Update master' : 'Create master'}</button></div>
            </form>
          </section>
        </div>
      )}

      {dialog?.type === 'view' && (
        <div className="irm-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}>
          <section className="irm-dialog" role="dialog" aria-modal="true" aria-labelledby="irm-view-title">
            <header className="irm-dialog-head"><div><h2 id="irm-view-title">{dialog.master.productName}</h2><p>{dialog.master.productCode} · Effective {dialog.master.effectiveDate}</p></div><button className="irm-close" type="button" onClick={() => setDialog(null)} aria-label="Close details"><X size={18} /></button></header>
            <div className="irm-tier-view"><h3>Rate tiers</h3><table className="irm-tier-table"><thead><tr><th>Sr.</th><th>Up to amount</th><th>Up to months</th><th>Normal interest</th><th>Penal rate</th><th>Adhoc rate</th></tr></thead><tbody>{dialog.master.bands.map((band, index) => <tr key={band.id}><td>{index + 1}</td><td>{formatUpperAmount(band.upToAmount)}</td><td>{band.upToMonths}</td><td>{band.normalInterest}%</td><td>{band.penalRate !== '' && band.penalRate != null ? `${band.penalRate}%` : '—'}</td><td>{band.adhocRate !== '' && band.adhocRate != null ? `${band.adhocRate}%` : '—'}</td></tr>)}</tbody></table></div>
            <footer className="irm-dialog-footer"><button className="ir-btn" type="button" onClick={() => setDialog(null)}>Close</button></footer>
          </section>
        </div>
      )}
      {productPickerOpen && dialog?.type === 'form' && (
        <div className="irm-overlay irm-picker-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProductPickerOpen(false); }}>
          <section className="irm-dialog irm-picker" role="dialog" aria-modal="true" aria-labelledby="irm-picker-title" onKeyDown={(event) => { if (event.key === 'Escape') setProductPickerOpen(false); }}>
            <header className="irm-dialog-head">
              <div><h2 id="irm-picker-title">Select a product</h2><p>Search the product catalog by product code or product name.</p></div>
              <button className="irm-close" type="button" onClick={() => setProductPickerOpen(false)} aria-label="Close product search"><X size={18} /></button>
            </header>
            <div className="irm-picker-content">
              <label className="irm-picker-search" htmlFor="irm-product-search">
                <Search size={17} aria-hidden="true" />
                <input id="irm-product-search" type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search by code or product name" autoComplete="off" autoFocus />
              </label>
              <div className="irm-picker-results">
                <table className="irm-picker-table">
                  <thead><tr><th scope="col">Product code</th><th scope="col">Product name</th><th scope="col">Effective date(s)</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
                  <tbody>
                    {productsLoading
                      ? <tr><td className="irm-picker-empty" colSpan="4">Loading products from the backend...</td></tr>
                      : filteredProducts.map((product) => (
                        <tr key={String(product.id)}>
                          <td className="irm-picker-code">{product.code}</td>
                          <td>{product.name}</td>
                          <td>{product.effectiveDates.length ? product.effectiveDates.join(' · ') : 'No saved rates'}</td>
                          <td><button className="irm-picker-select" type="button" onClick={() => selectProduct(product)}>Select</button></td>
                        </tr>
                      ))}
                    {!productsLoading && filteredProducts.length === 0 && (
                      products.length
                        ? <tr><td className="irm-picker-empty" colSpan="4">No products match your search.</td></tr>
                        : <tr><td className="irm-picker-empty" colSpan="4">No products are available in the backend catalog.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}
      {dialog?.type === 'delete' && (
        <div className="irm-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}>
          <section className="irm-dialog narrow" role="dialog" aria-modal="true" aria-labelledby="irm-delete-title">
            <header className="irm-dialog-head"><div><h2 id="irm-delete-title">Delete interest rate master?</h2><p>{dialog.master.productCode} · {dialog.master.productName}</p></div><button className="irm-close" type="button" onClick={() => setDialog(null)} aria-label="Close delete confirmation"><X size={18} /></button></header>
            <div className="irm-tier-view"><p style={{ margin: 0 }}>This permanently deletes the interest rate master from the backend.</p></div>
            <footer className="irm-dialog-footer"><button className="ir-btn" type="button" onClick={() => setDialog(null)}>Cancel</button><button className="ir-btn ir-submit" type="button" onClick={() => deleteMaster(dialog.master)}>Delete</button></footer>
          </section>
        </div>
      )}
    </AppShell>
  );
}