'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Camera, Upload, Save, Loader2, ChevronDown, Globe, MapPin,
  User, ZoomIn, ZoomOut, RotateCcw, Phone, AlertCircle, CalendarDays,
} from 'lucide-react';
import { usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ── Data ──────────────────────────────────────────────────────────────────────

const DIAL_CODES = [
  { code: 'IN', name: 'India',          dial: '+91',  flag: '🇮🇳' },
  { code: 'US', name: 'United States',  dial: '+1',   flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dial: '+44',  flag: '🇬🇧' },
  { code: 'AE', name: 'UAE',            dial: '+971', flag: '🇦🇪' },
  { code: 'CA', name: 'Canada',         dial: '+1',   flag: '🇨🇦' },
  { code: 'AU', name: 'Australia',      dial: '+61',  flag: '🇦🇺' },
  { code: 'SG', name: 'Singapore',      dial: '+65',  flag: '🇸🇬' },
  { code: 'QA', name: 'Qatar',          dial: '+974', flag: '🇶🇦' },
  { code: 'SA', name: 'Saudi Arabia',   dial: '+966', flag: '🇸🇦' },
  { code: 'MY', name: 'Malaysia',       dial: '+60',  flag: '🇲🇾' },
  { code: 'NZ', name: 'New Zealand',    dial: '+64',  flag: '🇳🇿' },
  { code: 'DE', name: 'Germany',        dial: '+49',  flag: '🇩🇪' },
  { code: 'FR', name: 'France',         dial: '+33',  flag: '🇫🇷' },
  { code: 'JP', name: 'Japan',          dial: '+81',  flag: '🇯🇵' },
  { code: 'ZA', name: 'South Africa',   dial: '+27',  flag: '🇿🇦' },
];

const COUNTRIES = [
  'India', 'United States', 'United Kingdom', 'United Arab Emirates',
  'Canada', 'Australia', 'Singapore', 'Qatar', 'Saudi Arabia',
  'Malaysia', 'New Zealand', 'Germany', 'France', 'Japan', 'South Africa',
];

const INDIA_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa',
  'Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
  'Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
  'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
  'Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Chandigarh',
  'Jammu & Kashmir','Ladakh','Puducherry','Andaman & Nicobar',
];

const INDIA_DISTRICTS: Record<string, string[]> = {
  'Andhra Pradesh':     ['Visakhapatnam','Vijayawada','Guntur','Nellore','Tirupati','Kurnool','Kakinada','Rajahmundry','Kadapa','Anantapur'],
  'Arunachal Pradesh':  ['Itanagar','Tawang','Bomdila','Pasighat','Ziro','Along','Naharlagun','Tezu'],
  Assam:                ['Guwahati','Dibrugarh','Jorhat','Silchar','Tezpur','Tinsukia','Nagaon','Kamrup','Bongaigaon'],
  Bihar:                ['Patna','Gaya','Bhagalpur','Muzaffarpur','Purnia','Darbhanga','Arrah','Begusarai','Munger'],
  Chhattisgarh:         ['Raipur','Bhilai','Bilaspur','Korba','Raigarh','Jagdalpur','Ambikapur','Rajnandgaon'],
  Goa:                  ['Panaji','Margao','Vasco da Gama','Mapusa','Ponda','Bicholim'],
  Gujarat:              ['Ahmedabad','Surat','Vadodara','Rajkot','Bhavnagar','Jamnagar','Gandhinagar','Anand','Junagadh'],
  Haryana:              ['Gurugram','Faridabad','Panipat','Ambala','Hisar','Rohtak','Karnal','Sonipat','Yamunanagar'],
  'Himachal Pradesh':   ['Shimla','Dharamsala','Manali','Kullu','Mandi','Solan','Hamirpur','Baddi','Palampur'],
  Jharkhand:            ['Ranchi','Jamshedpur','Dhanbad','Bokaro','Hazaribagh','Deoghar','Giridih','Dumka'],
  Karnataka:            ['Bengaluru','Mysuru','Hubli','Mangaluru','Belagavi','Kalaburagi','Udupi','Shimoga','Tumkur','Davangere'],
  Kerala:               ['Thiruvananthapuram','Kochi','Kozhikode','Thrissur','Kannur','Kollam','Palakkad','Alappuzha','Kottayam'],
  'Madhya Pradesh':     ['Bhopal','Indore','Jabalpur','Gwalior','Ujjain','Sagar','Rewa','Satna','Ratlam'],
  Maharashtra:          ['Mumbai','Pune','Nagpur','Thane','Nashik','Aurangabad','Solapur','Kolhapur','Navi Mumbai','Amravati'],
  Manipur:              ['Imphal','Churachandpur','Thoubal','Bishnupur','Senapati','Ukhrul','Chandel'],
  Meghalaya:            ['Shillong','Tura','Jowai','Nongpoh','Williamnagar','Baghmara'],
  Mizoram:              ['Aizawl','Lunglei','Champhai','Kolasib','Serchhip','Lawngtlai'],
  Nagaland:             ['Kohima','Dimapur','Mokokchung','Tuensang','Wokha','Zunheboto','Mon','Phek','Kiphire','Longleng'],
  Odisha:               ['Bhubaneswar','Cuttack','Berhampur','Rourkela','Sambalpur','Puri','Balasore','Bhadrak','Baripada'],
  Punjab:               ['Ludhiana','Amritsar','Jalandhar','Patiala','Bathinda','Mohali','Hoshiarpur','Phagwara'],
  Rajasthan:            ['Jaipur','Jodhpur','Udaipur','Kota','Bikaner','Ajmer','Bhilwara','Alwar','Bharatpur'],
  Sikkim:               ['Gangtok','Namchi','Gyalshing','Mangan','Rangpo'],
  'Tamil Nadu':         ['Chennai','Coimbatore','Madurai','Tiruchirappalli','Salem','Tirunelveli','Vellore','Erode','Tiruppur','Thoothukudi'],
  Telangana:            ['Hyderabad','Warangal','Nizamabad','Karimnagar','Khammam','Nalgonda','Secunderabad','Mahbubnagar'],
  Tripura:              ['Agartala','Dharmanagar','Udaipur','Kailasahar','Ambassa','Belonia'],
  'Uttar Pradesh':      ['Lucknow','Kanpur','Agra','Varanasi','Prayagraj','Meerut','Noida','Ghaziabad','Gorakhpur','Mathura'],
  Uttarakhand:          ['Dehradun','Haridwar','Nainital','Rishikesh','Haldwani','Roorkee','Mussoorie','Almora','Rudrapur'],
  'West Bengal':        ['Kolkata','Howrah','Asansol','Siliguri','Durgapur','Bardhaman','Kharagpur','Haldia'],
  Delhi:                ['New Delhi','Central Delhi','North Delhi','South Delhi','East Delhi','West Delhi','Dwarka','Rohini','Janakpuri'],
  Chandigarh:           ['Chandigarh','Manimajra','Panchkula'],
  'Jammu & Kashmir':    ['Srinagar','Jammu','Anantnag','Baramulla','Sopore','Kathua','Udhampur','Pulwama'],
  Ladakh:               ['Leh','Kargil','Nyoma','Diskit'],
  Puducherry:           ['Puducherry','Karaikal','Mahe','Yanam','Ozhukarai'],
  'Andaman & Nicobar':  ['Port Blair','Car Nicobar','Havelock Island','Diglipur','Mayabunder'],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDial(val: string): { code: string; number: string } {
  for (const dc of DIAL_CODES) {
    if (val?.startsWith(dc.dial + ' ')) return { code: dc.code, number: val.slice(dc.dial.length + 1) };
  }
  return { code: 'IN', number: val ?? '' };
}

function composePhone(code: string, number: string): string {
  if (!number.trim()) return '';
  const dc = DIAL_CODES.find(d => d.code === code) ?? DIAL_CODES[0];
  return `${dc.dial} ${number.trim()}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const inp = 'w-full bg-background border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/40';
const selCls = inp + ' appearance-none cursor-pointer pr-8';

function Field({ label, required, icon, children }: { label: string; required?: boolean; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-bold text-foreground/70 uppercase tracking-wider">
        {icon && <span className="opacity-60">{icon}</span>}
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function PhoneInput({ value, onChange, placeholder = 'Phone number' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const p = parseDial(value);
  const [dialCode, setDialCode] = useState(p.code);
  const [number,   setNumber]   = useState(p.number);
  const [open,     setOpen]     = useState(false);
  const [dropPos,  setDropPos]  = useState({ top: 0, left: 0, width: 0 });
  const ref    = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const inited = useRef(false);

  useEffect(() => {
    if (!inited.current && value) {
      const pp = parseDial(value);
      setDialCode(pp.code); setNumber(pp.number); inited.current = true;
    }
  }, [value]);

  useEffect(() => { onChange(composePhone(dialCode, number)); }, [dialCode, number]); // eslint-disable-line

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: 240 });
    }
    setOpen(o => !o);
  };

  const sel = DIAL_CODES.find(d => d.code === dialCode) ?? DIAL_CODES[0];

  return (
    <div ref={ref} className="relative flex">
      <button ref={btnRef} type="button" onClick={handleOpen}
        className="flex items-center gap-1 shrink-0 bg-background border-2 border-border border-r-0 rounded-l-xl px-2.5 py-2.5 text-sm hover:bg-muted transition-all min-w-[86px]">
        <span className="text-base leading-none">{sel.flag}</span>
        <span className="text-xs font-mono font-bold">{sel.dial}</span>
        <ChevronDown className={cn('w-3 h-3 text-muted-foreground ml-auto transition-transform', open && 'rotate-180')} />
      </button>
      <input type="tel" value={number} onChange={e => setNumber(e.target.value.replace(/[^\d\s\-()]/g, ''))}
        placeholder={placeholder}
        className="flex-1 bg-background border-2 border-border rounded-r-xl px-3 py-2.5 text-sm font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
      {open && typeof document !== 'undefined' && createPortal(
        <div style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width }}
          className="dial-code-dropdown bg-card border border-border/60 rounded-xl shadow-2xl overflow-y-auto max-h-52">
          {DIAL_CODES.map((dc, i) => (
            <button key={dc.code} type="button" onClick={() => { setDialCode(dc.code); setOpen(false); }}
              className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/70 transition text-left',
                i === 0 && 'rounded-t-xl', i === DIAL_CODES.length - 1 && 'rounded-b-xl',
                dialCode === dc.code && 'bg-primary/10 text-primary font-semibold')}>
              <span className="text-lg w-6 shrink-0">{dc.flag}</span>
              <span className="flex-1 truncate text-xs">{dc.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{dc.dial}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

function ImagePickerModal({ current, onConfirm, onClose }: { current: string; onConfirm: (url: string) => void; onClose: () => void }) {
  const [tab,        setTab]        = useState<'preview' | 'adjust'>('preview');
  const [urlInput,   setUrlInput]   = useState(current);
  const [fileUrl,    setFileUrl]    = useState<string | null>(null);
  const [imageSrc,   setImageSrc]   = useState(current);
  const [zoom,       setZoom]       = useState(1);
  const [pan,        setPan]        = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart,  setDragStart]  = useState({ x: 0, y: 0 });
  const [imgDims,    setImgDims]    = useState({ w: 0, h: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    const url = URL.createObjectURL(file);
    setFileUrl(url); setImageSrc(url); setZoom(1); setPan({ x: 0, y: 0 }); setTab('adjust');
  };

  const getBase = () => {
    if (!imgDims.w || !imgDims.h) return { w: 220, h: 220 };
    const S = 220, ar = imgDims.w / imgDims.h;
    return ar >= 1 ? { w: S * ar, h: S } : { w: S, h: S / ar };
  };

  const handleMouseDown = (e: React.MouseEvent) => { setIsDragging(true); setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); e.preventDefault(); };
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const S = 220, b = getBase();
    const maxX = Math.max(0, (b.w * zoom - S) / 2), maxY = Math.max(0, (b.h * zoom - S) / 2);
    setPan({ x: Math.max(-maxX, Math.min(maxX, e.clientX - dragStart.x)), y: Math.max(-maxY, Math.min(maxY, e.clientY - dragStart.y)) });
  }, [isDragging, dragStart, zoom, imgDims]); // eslint-disable-line
  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [handleMouseMove, handleMouseUp]);

  const handleConfirm = () => {
    if (!imageSrc) { onClose(); return; }
    if (fileUrl === imageSrc) {
      const img = new Image();
      img.onload = () => {
        const S = 220, ar = img.naturalWidth / img.naturalHeight;
        const baseW = ar >= 1 ? S * ar : S, baseH = ar >= 1 ? S : S / ar;
        const scaledW = baseW * zoom, scaledH = baseH * zoom;
        const visL = (scaledW - S) / 2 - pan.x, visT = (scaledH - S) / 2 - pan.y;
        const canvas = document.createElement('canvas');
        canvas.width = 300; canvas.height = 300;
        canvas.getContext('2d')!.drawImage(img, (visL / scaledW) * img.naturalWidth, (visT / scaledH) * img.naturalHeight,
          (S / scaledW) * img.naturalWidth, (S / scaledH) * img.naturalHeight, 0, 0, 300, 300);
        onConfirm(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.src = imageSrc;
    } else { onConfirm(urlInput || imageSrc); }
  };

  const base = getBase();

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-lifted border border-border/60 w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center">
              <Camera className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Profile Photo</h3>
              <p className="text-[11px] text-muted-foreground">Upload & adjust</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1 p-1.5 bg-muted/40 border-b border-border/30">
          {(['preview', 'adjust'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold transition-all',
                tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {t === 'preview' ? '👁 Preview' : '✂️ Crop'}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3 min-h-[260px]">
          {tab === 'preview' && (
            <div className="space-y-3">
              <div className="flex justify-center">
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-primary/30 shadow-lg bg-muted ring-4 ring-primary/10">
                  {imageSrc ? <img src={imageSrc} alt="preview" className="w-full h-full object-cover" />
                    : <div className="w-full h-full gradient-brand flex items-center justify-center"><Camera className="w-8 h-8 text-white opacity-50" /></div>}
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              <button onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary border border-primary/30 rounded-lg py-2.5 text-sm font-bold hover:bg-primary/15 transition-all">
                <Upload className="w-3.5 h-3.5" /> Upload from device
              </button>
              <input value={urlInput} onChange={e => { setUrlInput(e.target.value); if (e.target.value) setImageSrc(e.target.value); }}
                placeholder="https://example.com/photo.jpg"
                className="w-full bg-muted/50 border border-border/60 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
          )}
          {tab === 'adjust' && (
            <div className="space-y-3">
              {imageSrc ? (
                <>
                  <div className="flex justify-center">
                    <div className={cn('relative w-[220px] h-[220px] rounded-full overflow-hidden border-4 border-primary/40 shadow-lg bg-muted select-none', isDragging ? 'cursor-grabbing' : 'cursor-grab')}
                      onMouseDown={handleMouseDown}>
                      <img src={imageSrc} alt="adjust" draggable={false}
                        onLoad={e => { const t = e.currentTarget; setImgDims({ w: t.naturalWidth, h: t.naturalHeight }); }}
                        className={cn('avatar-crop-img', isDragging && 'is-dragging')}
                        style={{ width: `${base.w * zoom}px`, height: `${base.h * zoom}px`,
                          left: `${(220 - base.w * zoom) / 2 + pan.x}px`, top: `${(220 - base.h * zoom) / 2 + pan.y}px` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ZoomOut className="w-3.5 h-3.5" />
                    <input type="range" min={1} max={3} step={0.05} value={zoom}
                      onChange={e => { setZoom(Number(e.target.value)); setPan({ x: 0, y: 0 }); }}
                      className="flex-1 h-1.5 cursor-pointer accent-primary" />
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span className="font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-[10px]">{Math.round(zoom * 100)}%</span>
                  </div>
                  <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted/50 rounded-lg px-3 py-1.5 transition">
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                  <Camera className="w-10 h-10 opacity-20" />
                  <p className="text-sm">No photo selected</p>
                  <button onClick={() => setTab('preview')} className="text-xs text-primary hover:underline">← Preview tab</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-4 pb-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-border/60 text-sm font-semibold hover:bg-muted/50 transition">Cancel</button>
          <button onClick={handleConfirm} disabled={!imageSrc}
            className="flex-1 py-2 rounded-lg gradient-brand text-white text-sm font-bold hover:opacity-90 transition-all disabled:opacity-40 shadow-brand">
            Use this ✓
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export function EditProfileModal({ onClose }: { onClose: () => void }) {
  const { user, updateUser } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [showImgModal, setShowImgModal] = useState(false);

  const [profile, setProfile] = useState({
    firstName: '', lastName: '', phoneCode: 'IN', phone: '',
    emergencyCode: 'IN', emergencyContact: '', gender: '', dateOfBirth: '',
    country: 'India', address: '', state: '', city: '', pincode: '', avatar: '',
  });

  useEffect(() => {
    usersApi.getMe().then((data: any) => {
      const ph = parseDial(data.phone ?? ''), ec = parseDial(data.emergencyContact ?? '');
      setProfile({
        firstName: data.firstName ?? '', lastName: data.lastName ?? '',
        phoneCode: ph.code, phone: ph.number, emergencyCode: ec.code, emergencyContact: ec.number,
        gender: data.gender ?? '',
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split('T')[0] : '',
        address: data.address ?? '', state: data.state ?? '', city: data.city ?? '',
        pincode: data.pincode ?? '', avatar: data.avatar ?? '', country: data.country ?? 'India',
      });
    }).catch(() => {});
  }, []);

  const set = (k: string, v: any) => setProfile(p => ({ ...p, [k]: v }));

  const saveProfile = async () => {
    if (!profile.firstName.trim()) { toast.error('First name is required'); return; }
    setSaving(true);
    try {
      const payload: any = {
        firstName: profile.firstName, lastName: profile.lastName,
        phone: composePhone(profile.phoneCode, profile.phone) || undefined,
        emergencyContact: composePhone(profile.emergencyCode, profile.emergencyContact) || undefined,
        gender: profile.gender || undefined, address: profile.address || undefined,
        city: profile.city || undefined, state: profile.state || undefined,
        pincode: profile.pincode || undefined, avatar: profile.avatar || undefined,
        country: profile.country || undefined,
      };
      if (profile.dateOfBirth) payload.dateOfBirth = new Date(profile.dateOfBirth).toISOString();
      const updated: any = await usersApi.updateMe(payload);
      updateUser({ firstName: updated.firstName, lastName: updated.lastName, avatar: updated.avatar, phone: updated.phone });
      toast.success('Profile updated!');
      onClose();
    } catch { } finally { setSaving(false); }
  };

  const isIndia = profile.country === 'India';
  const stateDistricts = isIndia ? (INDIA_DISTRICTS[profile.state] ?? null) : null;

  return (
    <>
      {showImgModal && (
        <ImagePickerModal
          current={profile.avatar}
          onConfirm={url => { set('avatar', url); setShowImgModal(false); }}
          onClose={() => setShowImgModal(false)}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in" onClick={onClose}>
        <div className="bg-card border border-border/80 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col animate-pop overflow-hidden"
          onClick={e => e.stopPropagation()}>

          {/* ── Colorful Header ── */}
          <div className="relative overflow-hidden shrink-0 gradient-violet">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15),_transparent_60%)]" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -top-4 right-16 w-20 h-20 rounded-full bg-pink-400/20 blur-xl" />
            <div className="relative px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Avatar in header */}
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border-3 border-white/40 shadow-xl ring-2 ring-white/20">
                    {profile.avatar
                      ? <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-white/20 flex items-center justify-center text-white font-extrabold text-xl">
                          {profile.firstName?.[0]}{profile.lastName?.[0]}
                        </div>}
                  </div>
                  <button onClick={() => setShowImgModal(true)}
                    className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-white rounded-xl shadow-lg flex items-center justify-center hover:scale-110 transition-transform">
                    <Camera className="w-3.5 h-3.5 text-violet-600" />
                  </button>
                </div>
                <div>
                  <h2 className="font-extrabold text-xl text-white leading-tight">
                    {profile.firstName || 'Edit'} {profile.lastName || 'Profile'}
                  </h2>
                  <p className="text-white/70 text-xs mt-0.5">Update your personal information</p>
                  <button onClick={() => setShowImgModal(true)}
                    className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-white/80 hover:text-white bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg transition-all">
                    <Upload className="w-2.5 h-2.5" /> Change Photo
                  </button>
                </div>
              </div>
              <button onClick={onClose}
                className="w-9 h-9 rounded-2xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="overflow-y-auto flex-1 p-5 space-y-5 bg-muted/30">

            {/* ── Personal Info Section ── */}
            <div className="rounded-2xl overflow-hidden shadow-sm border border-border bg-card">
              <div className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-violet-500 to-indigo-500">
                <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-extrabold text-sm text-white tracking-wide">Personal Information</h3>
              </div>

              <div className="p-5 grid grid-cols-2 gap-4">
                <Field label="First Name" required icon={<User className="w-3 h-3" />}>
                  <input value={profile.firstName} onChange={e => set('firstName', e.target.value)}
                    className={cn(inp, 'focus:border-violet-500 focus:ring-violet-500/10')} placeholder="John" />
                </Field>
                <Field label="Last Name" required icon={<User className="w-3 h-3" />}>
                  <input value={profile.lastName} onChange={e => set('lastName', e.target.value)}
                    className={cn(inp, 'focus:border-violet-500 focus:ring-violet-500/10')} placeholder="Doe" />
                </Field>
                <Field label="Date of Birth" icon={<CalendarDays className="w-3 h-3" />}>
                  <input type="date" value={profile.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)}
                    className={cn(inp, 'focus:border-indigo-500 focus:ring-indigo-500/10')} />
                </Field>
                <Field label="Gender">
                  <div className="relative">
                    <select value={profile.gender} onChange={e => set('gender', e.target.value)}
                      className={cn(selCls, 'focus:border-indigo-500 focus:ring-indigo-500/10')}>
                      <option value="">Select gender</option>
                      {['Male','Female','Other','Prefer not to say'].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </Field>
              </div>
            </div>

            {/* ── Contact Section ── */}
            <div className="rounded-2xl overflow-hidden shadow-sm border border-border bg-card">
              <div className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-pink-500 to-rose-500">
                <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                  <Phone className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-extrabold text-sm text-white tracking-wide">Contact Details</h3>
              </div>
              <div className="p-5 grid grid-cols-2 gap-4">
                <Field label="Phone Number" icon={<Phone className="w-3 h-3" />}>
                  <PhoneInput value={composePhone(profile.phoneCode, profile.phone)}
                    onChange={v => { const p = parseDial(v); set('phoneCode', p.code); set('phone', p.number); }}
                    placeholder="Phone number" />
                </Field>
                <Field label="Emergency Contact" icon={<AlertCircle className="w-3 h-3" />}>
                  <PhoneInput value={composePhone(profile.emergencyCode, profile.emergencyContact)}
                    onChange={v => { const p = parseDial(v); set('emergencyCode', p.code); set('emergencyContact', p.number); }}
                    placeholder="Emergency" />
                </Field>
              </div>
            </div>

            {/* ── Address Section ── */}
            <div className="rounded-2xl overflow-hidden shadow-sm border border-border bg-card">
              <div className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500">
                <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-extrabold text-sm text-white tracking-wide">Address</h3>
              </div>
              <div className="p-5 space-y-4">
                <Field label="Street Address" icon={<MapPin className="w-3 h-3" />}>
                  <input value={profile.address} onChange={e => set('address', e.target.value)}
                    placeholder="123 Main Street, Apt 4"
                    className={cn(inp, 'focus:border-emerald-500 focus:ring-emerald-500/10')} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Country" icon={<Globe className="w-3 h-3" />}>
                    <div className="relative">
                      <select value={profile.country}
                        onChange={e => { set('country', e.target.value); set('state', ''); set('city', ''); }}
                        className={cn(selCls, 'focus:border-teal-500 focus:ring-teal-500/10')}>
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                  </Field>
                  <Field label="Pincode / ZIP">
                    <input value={profile.pincode} onChange={e => set('pincode', e.target.value)}
                      placeholder="400001"
                      className={cn(inp, 'focus:border-teal-500 focus:ring-teal-500/10')} />
                  </Field>
                  <Field label="State / Province">
                    {isIndia ? (
                      <div className="relative">
                        <select value={profile.state}
                          onChange={e => { set('state', e.target.value); set('city', ''); }}
                          className={cn(selCls, 'focus:border-emerald-500 focus:ring-emerald-500/10')}>
                          <option value="">Select state</option>
                          {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      </div>
                    ) : (
                      <input value={profile.state} onChange={e => set('state', e.target.value)}
                        placeholder="State" className={cn(inp, 'focus:border-emerald-500 focus:ring-emerald-500/10')} />
                    )}
                  </Field>
                  <Field label={isIndia ? 'District / City' : 'City'}>
                    {stateDistricts ? (
                      <div className="relative">
                        <select value={profile.city} onChange={e => set('city', e.target.value)}
                          className={cn(selCls, 'focus:border-emerald-500 focus:ring-emerald-500/10')}>
                          <option value="">Select district</option>
                          {stateDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      </div>
                    ) : (
                      <input value={profile.city} onChange={e => set('city', e.target.value)}
                        placeholder="City" className={cn(inp, 'focus:border-emerald-500 focus:ring-emerald-500/10')} />
                    )}
                  </Field>
                </div>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="flex gap-3 px-5 py-4 border-t border-border shrink-0 bg-card">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-2xl border-2 border-border hover:bg-muted text-sm font-bold transition-all">
              Cancel
            </button>
            <button onClick={saveProfile} disabled={saving}
              className="flex-[2] py-3 rounded-2xl gradient-violet text-white font-extrabold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-violet/30">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
