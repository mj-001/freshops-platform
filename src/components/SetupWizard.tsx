import React, { useState, useEffect } from 'react';
import { Building2, ArrowRight, ArrowLeft, Plus, Trash2, Loader2, Check, CheckCircle2, AlertCircle } from 'lucide-react';

interface SetupWizardProps {
  onComplete: () => void;
}

interface WarehouseRow {
  name: string;
  type: 'main_warehouse' | 'fulfilment_point';
  area: string;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  // Collected fields
  const [companyName, setCompanyName] = useState<string>('');
  const [country, setCountry] = useState<string>('KE');
  const [currency, setCurrency] = useState<string>('KES');
  const [primaryLanguage, setPrimaryLanguage] = useState<string>('en');

  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([
    { name: 'Primary Warehouse', type: 'main_warehouse', area: 'Nairobi HQ' }
  ]);

  const [adminName, setAdminName] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState<string>('');

  // Sync currency when country changes
  useEffect(() => {
    const countryToCurrency: { [key: string]: string } = {
      KE: 'KES',
      UG: 'UGX',
      TZ: 'TZS',
      RW: 'RWF',
      ET: 'ETB',
      NG: 'NGN',
      GH: 'GHS',
      ZA: 'ZAR',
      Other: 'USD'
    };
    setCurrency(countryToCurrency[country] || 'USD');
  }, [country]);

  const handleNext = () => {
    setError(null);
    const errors: { [key: string]: string } = {};

    if (step === 2) {
      if (!companyName.trim()) {
        errors.companyName = 'Company name is required';
      } else if (companyName.trim().length < 2) {
        errors.companyName = 'Company name must be at least 2 characters';
      }
    }

    if (step === 3) {
      const invalid = warehouses.some(w => !w.name.trim());
      if (invalid) {
        errors.warehouses = 'Please provide a name for all warehouses';
      }
      if (warehouses.length < 1) {
        errors.warehouses = 'At least one warehouse is required';
      }
    }

    if (step === 4) {
      if (!adminName.trim()) errors.adminName = 'Admin name is required';
      if (!adminEmail.trim()) {
        errors.adminEmail = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
        errors.adminEmail = 'Please introduce a valid email address';
      }
      if (!adminPassword) {
        errors.adminPassword = 'Password is required';
      } else if (adminPassword.length < 8) {
        errors.adminPassword = 'Password must be at least 8 characters';
      }
      if (adminPassword !== adminConfirmPassword) {
        errors.adminConfirmPassword = 'Passwords do not match';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    setFieldErrors({});
    setStep(prev => Math.max(1, prev - 1));
  };

  const handleAddWarehouse = () => {
    setWarehouses(prev => [
      ...prev,
      { name: '', type: 'fulfilment_point', area: '' }
    ]);
  };

  const handleRemoveWarehouse = (index: number) => {
    if (warehouses.length > 1) {
      setWarehouses(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleUpdateWarehouse = (index: number, key: keyof WarehouseRow, val: string) => {
    setWarehouses(prev => prev.map((w, i) => {
      if (i === index) {
        return { ...w, [key]: val };
      }
      return w;
    }));
  };

  const handleLaunch = async () => {
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const payload = {
      company_name: companyName,
      country,
      currency,
      primary_language: primaryLanguage,
      warehouses: warehouses.map(w => ({
        name: w.name,
        type: w.type,
        area: w.area
      })),
      admin_user: {
        name: adminName,
        email: adminEmail,
        password: adminPassword
      }
    };

    try {
      const res = await fetch('/api/v1/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.data?.success) {
        onComplete();
      } else {
        if (data.error) {
          setError(data.error.message || 'Setup completion failed.');
          if (data.error.field) {
            setFieldErrors({ [data.error.field]: data.error.message });
          }
        } else {
          setError('An unexpected error occurred during setup.');
        }
      }
    } catch (err) {
      setError('Network communication failure. Please verify connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  const countries = [
    { code: 'KE', name: 'Kenya' },
    { code: 'UG', name: 'Uganda' },
    { code: 'TZ', name: 'Tanzania' },
    { code: 'RW', name: 'Rwanda' },
    { code: 'ET', name: 'Ethiopia' },
    { code: 'NG', name: 'Nigeria' },
    { code: 'GH', name: 'Ghana' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'Other', name: 'Other' }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 overflow-y-auto font-sans z-50">
      
      {/* Container Card */}
      <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-10 flex flex-col relative my-6">
        
        {/* Step Indicator Headers */}
        {step > 1 && (
          <div className="flex justify-center space-x-2.5 mb-8">
            {[1, 2, 3, 4, 5].map((num) => (
              <span
                key={num}
                className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                  step === num ? 'bg-teal-400 scale-125' : step > num ? 'bg-teal-700' : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-200 text-xs flex gap-2.5 items-start">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
            <span className="leading-normal">{error}</span>
          </div>
        )}

        {/* STEP 1: WELCOME SCREEN */}
        {step === 1 && (
          <div className="text-center py-6 flex flex-col items-center">
            <div className="bg-teal-500/15 text-teal-400 p-4 rounded-2xl mb-6">
              <Building2 className="h-12 w-12" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-3 text-white">
              Welcome to FreshOpsPlatform
            </h2>
            <p className="text-slate-400 text-sm md:text-base max-w-md mx-auto leading-relaxed mb-10">
              Open source fresh food operations. Let's set up your operation. This takes about 5 minutes.
            </p>
            <button
              onClick={() => setStep(2)}
              className="px-8 py-3.5 bg-teal-500 hover:bg-teal-450 text-slate-950 font-bold rounded-xl flex items-center gap-2 text-sm justify-center min-h-[44px] shadow-lg shadow-teal-500/20 transform hover:-translate-y-0.5 transition cursor-pointer"
            >
              <span>Get started</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* STEP 2: YOUR BUSINESS */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-1.5">Tell us about your business</h3>
              <p className="text-slate-400 text-xs leading-normal">
                Set up your primary enterprise profile configuration.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Company Name *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Lumara Foods Ltd"
                  className={`w-full bg-slate-900 border ${
                    fieldErrors.companyName ? 'border-rose-500' : 'border-slate-800'
                  } rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-teal-500`}
                />
                {fieldErrors.companyName && (
                  <p className="text-rose-400 text-[11px] mt-1.5">{fieldErrors.companyName}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Country</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-hidden focus:border-teal-500 cursor-pointer"
                  >
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Primary Currency</label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 font-mono focus:outline-hidden focus:border-teal-500"
                  />
                  <p className="text-slate-500 text-[10px] mt-1">Auto-selected and overridable.</p>
                </div>
              </div>
            </div>

            {/* Bottom Nav */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-900 mt-8">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-4 py-2 hover:bg-slate-900 rounded-lg min-h-[44px] cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-teal-500 hover:bg-teal-450 text-slate-950 font-bold rounded-xl text-sm min-h-[44px] cursor-pointer"
              >
                <span>Next</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: WAREHOUSES */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-1.5">Where do you operate from?</h3>
              <p className="text-slate-400 text-xs">
                Add at least one main warehouse and any fulfilment points.
              </p>
            </div>

            {fieldErrors.warehouses && (
              <p className="text-rose-400 text-xs">{fieldErrors.warehouses}</p>
            )}

            <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
              {warehouses.map((w, idx) => (
                <div key={idx} className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl space-y-3.5 relative">
                  <div className="flex gap-2.5 items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Warehouse #{idx + 1}
                    </span>
                    {warehouses.length > 1 && (
                      <button
                        onClick={() => handleRemoveWarehouse(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded-sm cursor-pointer"
                        title="Remove warehouse"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Row Name</label>
                      <input
                        type="text"
                        value={w.name}
                        onChange={(e) => handleUpdateWarehouse(idx, 'name', e.target.value)}
                        placeholder="e.g. Regional Hub, Kiambu Point"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Area/Location</label>
                      <input
                        type="text"
                        value={w.area}
                        onChange={(e) => handleUpdateWarehouse(idx, 'area', e.target.value)}
                        placeholder="e.g. Industrial Area Sector 2"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Warehouse Type</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name={`type-${idx}`}
                          checked={w.type === 'main_warehouse'}
                          onChange={() => handleUpdateWarehouse(idx, 'type', 'main_warehouse')}
                          className="text-teal-500 focus:ring-0 cursor-pointer"
                        />
                        <span>Main Warehouse</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name={`type-${idx}`}
                          checked={w.type === 'fulfilment_point'}
                          onChange={() => handleUpdateWarehouse(idx, 'type', 'fulfilment_point')}
                          className="text-teal-500 focus:ring-0 cursor-pointer"
                        />
                        <span>Fulfilment Point</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <button
                onClick={handleAddWarehouse}
                className="w-full flex items-center justify-center gap-1.5 border border-dashed border-slate-800 hover:border-teal-500 py-3 rounded-xl text-xs text-slate-400 hover:text-white transition duration-200 cursor-pointer"
              >
                <Plus className="h-4.5 w-4.5" />
                <span>Add warehouse</span>
              </button>
            </div>

            {/* Bottom Nav */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-900 mt-8">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-4 py-2 hover:bg-slate-900 rounded-lg min-h-[44px] cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-teal-500 hover:bg-teal-450 text-slate-950 font-bold rounded-xl text-sm min-h-[44px] cursor-pointer"
              >
                <span>Next</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: ADMIN ACCOUNT */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-1.5">Create your account</h3>
              <p className="text-slate-400 text-xs">
                This will be the main admin account. You can add more team members after setup.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2"> Your Name * </label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className={`w-full bg-slate-900 border ${
                    fieldErrors.adminName ? 'border-rose-500' : 'border-slate-800'
                  } rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-teal-500`}
                />
                {fieldErrors.adminName && (
                  <p className="text-rose-400 text-[11px] mt-1.5">{fieldErrors.adminName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2"> Email Address * </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className={`w-full bg-slate-900 border ${
                    fieldErrors.adminEmail ? 'border-rose-500' : 'border-slate-800'
                  } rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-teal-500`}
                />
                {fieldErrors.adminEmail && (
                  <p className="text-rose-400 text-[11px] mt-1.5">{fieldErrors.adminEmail}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2"> Password * </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className={`w-full bg-slate-900 border ${
                      fieldErrors.adminPassword ? 'border-rose-500' : 'border-slate-800'
                    } rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-teal-500`}
                  />
                  {fieldErrors.adminPassword && (
                    <p className="text-rose-400 text-[11px] mt-1.5">{fieldErrors.adminPassword}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2"> Confirm Password * </label>
                  <input
                    type="password"
                    value={adminConfirmPassword}
                    onChange={(e) => setAdminConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className={`w-full bg-slate-900 border ${
                      fieldErrors.adminConfirmPassword ? 'border-rose-500' : 'border-slate-800'
                    } rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-teal-500`}
                  />
                  {fieldErrors.adminConfirmPassword && (
                    <p className="text-rose-400 text-[11px] mt-1.5">{fieldErrors.adminConfirmPassword}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Nav */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-900 mt-8">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-4 py-2 hover:bg-slate-900 rounded-lg min-h-[44px] cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-teal-500 hover:bg-teal-450 text-slate-950 font-bold rounded-xl text-sm min-h-[44px] cursor-pointer"
              >
                <span>Next</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW AND LAUNCH */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-1.5">Review and launch</h3>
              <p className="text-slate-400 text-xs">
                Check details below before starting FreshOpsPlatform.
              </p>
            </div>

            <div className="p-5 bg-slate-900 rounded-xl border border-slate-850 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 border-b border-slate-850 pb-3">
                <div>
                  <span className="text-slate-500 font-bold block mb-0.5">COMPANY</span>
                  <span className="text-slate-100 font-semibold">{companyName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block mb-0.5">LOCATION / CURRENCY</span>
                  <span className="text-slate-100 font-semibold">
                    {country} · {currency}
                  </span>
                </div>
              </div>

              <div className="border-b border-slate-850 pb-3">
                <span className="text-slate-500 font-bold block mb-1">OPERATIONAL WAREHOUSES</span>
                <ul className="space-y-1 text-slate-200">
                  {warehouses.map((w, idx) => (
                     <li key={idx} className="flex items-center justify-between">
                       <span className="font-semibold">{w.name || `Warehouse ${idx + 1}`}</span>
                       <span className="text-[10px] text-teal-400 font-bold bg-teal-500/10 px-2 py-0.5 rounded-md uppercase">
                         {w.type === 'main_warehouse' ? 'Main' : 'Fulfillment'}
                       </span>
                     </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-500 font-bold block mb-0.5">ADMIN EMAIL</span>
                  <span className="text-slate-100 font-mono">{adminEmail || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block mb-0.5">ADMIN NAME</span>
                  <span className="text-slate-100 font-semibold">{adminName || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Bottom Nav */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-900 mt-8">
              <button
                disabled={loading}
                onClick={handleBack}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-4 py-2 hover:bg-slate-900 rounded-lg min-h-[44px] disabled:opacity-50 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              <button
                disabled={loading}
                onClick={handleLaunch}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-teal-500 hover:bg-teal-450 text-slate-950 font-black rounded-xl text-sm min-h-[44px] disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Setting up operation...</span>
                  </>
                ) : (
                  <>
                    <span>Launch FreshOpsPlatform</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
