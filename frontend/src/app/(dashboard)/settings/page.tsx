'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  User, Lock, Dumbbell, Camera, Save, Eye, EyeOff,
  CheckCircle, AlertCircle, Loader2, X, Plus, Upload,
  ZoomIn, ZoomOut, RotateCcw, ChevronDown, Globe,
  MapPin, Phone, Sparkles, Shield, Pencil, Bell, Building2, Send,
} from 'lucide-react';
import { usersApi, trainersApi, authApi, gymsApi, renewalRemindersApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { EditProfileModal } from '@/components/shared/EditProfileModal';

// ── Data ─────────────────────────────────────────────────────────────────────

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
  { code: 'NP', name: 'Nepal',          dial: '+977', flag: '🇳🇵' },
  { code: 'LK', name: 'Sri Lanka',      dial: '+94',  flag: '🇱🇰' },
  { code: 'BD', name: 'Bangladesh',     dial: '+880', flag: '🇧🇩' },
  { code: 'PK', name: 'Pakistan',       dial: '+92',  flag: '🇵🇰' },
  { code: 'CN', name: 'China',          dial: '+86',  flag: '🇨🇳' },
];

const COUNTRIES = [
  'India', 'United States', 'United Kingdom', 'United Arab Emirates',
  'Canada', 'Australia', 'Singapore', 'Qatar', 'Saudi Arabia',
  'Malaysia', 'New Zealand', 'Germany', 'France', 'Japan',
  'South Africa', 'Nepal', 'Sri Lanka', 'Bangladesh', 'Pakistan', 'China',
];

const INDIA_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa',
  'Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
  'Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
  'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
  'Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Chandigarh',
  'Jammu & Kashmir','Ladakh','Puducherry','Andaman & Nicobar',
  'Dadra & Nagar Haveli','Daman & Diu','Lakshadweep',
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
  'Dadra & Nagar Haveli': ['Silvassa','Amli','Khanvel'],
  'Daman & Diu':        ['Daman','Diu','Moti Daman'],
  Lakshadweep:          ['Kavaratti','Agatti','Minicoy','Andrott'],
};

const SPECIALIZATION_OPTIONS = [
  'Weight Training','HIIT','CrossFit','Yoga','Pilates',
  'Cardio','Strength & Conditioning','Boxing','Zumba',
  'Calisthenics','Powerlifting','Bodybuilding','Functional Fitness',
];

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

// ── PhoneInput ────────────────────────────────────────────────────────────────

function PhoneInput({ value, onChange, placeholder = 'Phone number' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const p = parseDial(value);
  const [dialCode, setDialCode] = useState(p.code);
  const [number,   setNumber]   = useState(p.number);
  const [open,     setOpen]     = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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

  const sel = DIAL_CODES.find(d => d.code === dialCode) ?? DIAL_CODES[0];

  return (
    <div ref={ref} className="relative flex">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 shrink-0 bg-muted/60 border border-border/60 border-r-0 rounded-l-lg px-2.5 py-2 text-sm hover:bg-muted transition-all min-w-[82px]">
        <span className="text-base leading-none">{sel.flag}</span>
        <span className="text-xs font-mono font-bold">{sel.dial}</span>
        <ChevronDown className={cn('w-3 h-3 text-muted-foreground ml-auto transition-transform', open && 'rotate-180')} />
      </button>
      <input type="tel" value={number} onChange={e => setNumber(e.target.value.replace(/[^\d\s\-()]/g, ''))}
        placeholder={placeholder}
        className="flex-1 bg-muted/50 border border-border/60 rounded-r-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-60 bg-card border border-border/60 rounded-xl shadow-lifted overflow-y-auto max-h-52">
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
        </div>
      )}
    </div>
  );
}

// ── ImagePickerModal ──────────────────────────────────────────────────────────

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-lifted border border-border/60 w-full max-w-sm mx-4 overflow-hidden animate-bounce-in" onClick={e => e.stopPropagation()}>
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
                tab === t ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground')}>
              {t === 'preview' ? '👁 Preview' : '✂️ Crop'}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3 min-h-[260px]">
          {tab === 'preview' && (
            <div className="space-y-3 animate-fade-in">
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
            <div className="space-y-3 animate-fade-in">
              {imageSrc ? (
                <>
                  <div className="flex justify-center">
                    <div className={cn('relative w-[220px] h-[220px] rounded-full overflow-hidden border-4 border-primary/40 shadow-lg bg-muted select-none', isDragging ? 'cursor-grabbing' : 'cursor-grab')}
                      onMouseDown={handleMouseDown}>
                      <img src={imageSrc} alt="adjust" draggable={false}
                        onLoad={e => { const t = e.currentTarget; setImgDims({ w: t.naturalWidth, h: t.naturalHeight }); }}
                        style={{ position: 'absolute', width: `${base.w * zoom}px`, height: `${base.h * zoom}px`,
                          left: `${(220 - base.w * zoom) / 2 + pan.x}px`, top: `${(220 - base.h * zoom) / 2 + pan.y}px`,
                          pointerEvents: 'none', transition: isDragging ? 'none' : 'left .1s, top .1s' }} />
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

// ── Shared field wrapper ──────────────────────────────────────────────────────

const inp = 'w-full bg-muted/50 border border-border/60 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60';
const sel = inp + ' appearance-none cursor-pointer pr-8';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = 'profile' | 'trainer' | 'security' | 'gym' | 'notifications';

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const isTrainer = user?.role === 'TRAINER';
  const isAdmin = user?.role === 'GYM_ADMIN';
  const isMember = !isTrainer && !isAdmin;

  const [tab,             setTab]             = useState<Tab>(isAdmin ? 'profile' : 'security');
  const [saving,          setSaving]          = useState(false);
  const [showImgModal,    setShowImgModal]    = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [trainerData,     setTrainerData]     = useState<any>(null);

  const [profile, setProfile] = useState({
    firstName: '', lastName: '', phoneCode: 'IN', phone: '',
    emergencyCode: 'IN', emergencyContact: '', gender: '', dateOfBirth: '',
    country: 'India', address: '', state: '', city: '', pincode: '', avatar: '',
  });

  const [trainerForm, setTrainerForm] = useState({
    bio: '', experience: 0, hourlyRate: '',
    specializations: [] as string[], certifications: [] as string[],
  });
  const [newCert, setNewCert] = useState('');
  const [newSpec, setNewSpec] = useState('');
  const [pwForm,  setPwForm]  = useState({ current: '', newPw: '', confirm: '' });
  const [showPw,  setShowPw]  = useState({ current: false, newPw: false, confirm: false });
  const [gymData, setGymData] = useState<any>(null);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderPreview, setReminderPreview] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    usersApi.getMe().then((data: any) => {
      const ph = parseDial(data.phone ?? ''), ec = parseDial(data.emergencyContact ?? '');
      setProfile(prev => ({
        ...prev,
        firstName: data.firstName ?? '', lastName: data.lastName ?? '',
        phoneCode: ph.code, phone: ph.number, emergencyCode: ec.code, emergencyContact: ec.number,
        gender: data.gender ?? '', dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split('T')[0] : '',
        address: data.address ?? '', state: data.state ?? '', city: data.city ?? '',
        pincode: data.pincode ?? '', avatar: data.avatar ?? '',
      }));
      if (isTrainer && data.trainer) {
        setTrainerForm({
          bio: data.trainer.bio ?? '', experience: data.trainer.experience ?? 0,
          hourlyRate: data.trainer.hourlyRate ? String(data.trainer.hourlyRate) : '',
          specializations: data.trainer.specializations ?? [], certifications: data.trainer.certifications ?? [],
        });
        setTrainerData(data.trainer);
      }
    }).catch(() => {});
  }, [isTrainer]);

  useEffect(() => {
    if (!isAdmin || !user?.gymId) return;
    gymsApi.getOne(user.gymId).then((data: any) => {
      setGymData(data);
      setRemindersEnabled(data.renewalRemindersEnabled ?? true);
    }).catch(() => {});
  }, [isAdmin, user?.gymId]);

  const toggleReminders = async (enabled: boolean) => {
    if (!user?.gymId) return;
    setReminderSaving(true);
    try {
      await gymsApi.update(user.gymId, { renewalRemindersEnabled: enabled });
      setRemindersEnabled(enabled);
      toast.success(enabled ? 'Renewal reminders enabled' : 'Renewal reminders disabled');
    } catch { toast.error('Failed to update setting'); }
    finally { setReminderSaving(false); }
  };

  const loadReminderPreview = async () => {
    setPreviewLoading(true);
    try {
      const data: any = await renewalRemindersApi.preview();
      setReminderPreview(data);
    } catch { }
    finally { setPreviewLoading(false); }
  };

  const sendRemindersNow = async () => {
    try {
      const res: any = await renewalRemindersApi.sendNow();
      toast.success(res.message ?? 'Reminders sent!');
      setReminderPreview([]);
    } catch { }
  };

  const set = (k: string, v: any) => setProfile(p => ({ ...p, [k]: v }));

  const saveProfile = async () => {
    setSaving(true);
    try {
      const payload: any = {
        firstName: profile.firstName, lastName: profile.lastName,
        phone: composePhone(profile.phoneCode, profile.phone) || undefined,
        emergencyContact: composePhone(profile.emergencyCode, profile.emergencyContact) || undefined,
        gender: profile.gender || undefined, address: profile.address || undefined,
        city: profile.city || undefined, state: profile.state || undefined,
        pincode: profile.pincode || undefined, avatar: profile.avatar || undefined,
      };
      if (profile.dateOfBirth) payload.dateOfBirth = new Date(profile.dateOfBirth).toISOString();
      const updated: any = await usersApi.updateMe(payload);
      updateUser({ firstName: updated.firstName, lastName: updated.lastName, avatar: updated.avatar, phone: updated.phone });
      toast.success('Profile updated!');
    } catch { } finally { setSaving(false); }
  };

  const saveTrainer = async () => {
    if (!trainerData?.id) return;
    setSaving(true);
    try {
      await trainersApi.update(trainerData.id, {
        bio: trainerForm.bio || null, experience: Number(trainerForm.experience),
        hourlyRate: trainerForm.hourlyRate ? Number(trainerForm.hourlyRate) : null,
        specializations: trainerForm.specializations, certifications: trainerForm.certifications,
      });
      toast.success('Trainer profile saved!');
    } catch { } finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (!pwForm.current || !pwForm.newPw) { toast.error('Fill in all password fields'); return; }
    if (pwForm.newPw.length < 8) { toast.error('Min 8 characters'); return; }
    if (pwForm.newPw !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    try {
      await authApi.changePassword({ currentPassword: pwForm.current, newPassword: pwForm.newPw });
      setPwForm({ current: '', newPw: '', confirm: '' });
      toast.success('Password changed!');
    } catch { } finally { setSaving(false); }
  };

  const isIndia = profile.country === 'India';
  const stateDistricts = isIndia ? (INDIA_DISTRICTS[profile.state] ?? null) : null;

  const toggleSpec = (s: string) => setTrainerForm(f => ({
    ...f, specializations: f.specializations.includes(s) ? f.specializations.filter(x => x !== s) : [...f.specializations, s],
  }));
  const addCert    = () => { if (!newCert.trim()) return; setTrainerForm(f => ({ ...f, certifications: [...f.certifications, newCert.trim()] })); setNewCert(''); };
  const removeCert = (i: number) => setTrainerForm(f => ({ ...f, certifications: f.certifications.filter((_, idx) => idx !== i) }));

  const tabs: { id: Tab; label: string; icon: React.ElementType; show: boolean }[] = [
    { id: 'profile',       label: 'Profile',         icon: User,      show: isAdmin },
    { id: 'trainer',       label: 'Trainer Profile',  icon: Dumbbell,  show: isTrainer },
    { id: 'security',      label: 'Security',         icon: Shield,    show: true },
    { id: 'notifications', label: 'Notifications',    icon: Bell,      show: !isAdmin },
    { id: 'gym',           label: 'Gym Settings',     icon: Building2, show: isAdmin },
  ].filter(t => t.show);

  const handleEditProfileClose = () => {
    setShowEditProfile(false);
    usersApi.getMe().then((data: any) => {
      const ph = parseDial(data.phone ?? ''), ec = parseDial(data.emergencyContact ?? '');
      setProfile(prev => ({
        ...prev,
        firstName: data.firstName ?? '', lastName: data.lastName ?? '',
        phoneCode: ph.code, phone: ph.number, emergencyCode: ec.code, emergencyContact: ec.number,
        gender: data.gender ?? '',
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split('T')[0] : '',
        address: data.address ?? '', state: data.state ?? '', city: data.city ?? '',
        pincode: data.pincode ?? '', avatar: data.avatar ?? '', country: data.country ?? 'India',
      }));
    }).catch(() => {});
  };

  return (
    <>
      {showImgModal && (
        <ImagePickerModal current={profile.avatar}
          onConfirm={url => { set('avatar', url); setShowImgModal(false); }}
          onClose={() => setShowImgModal(false)} />
      )}
      {showEditProfile && <EditProfileModal onClose={handleEditProfileClose} />}

      <div className="max-w-4xl mx-auto animate-slide-up">

        {/* ── Compact hero banner ── */}
        <div className="relative overflow-hidden rounded-2xl gradient-brand mb-5 shadow-brand">
          <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 flex items-center gap-4 px-5 py-4">
            {/* Avatar */}
            <div className="relative shrink-0 group">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/20 border-2 border-white/40 shadow-lg">
                {profile.avatar
                  ? <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-white text-xl font-extrabold">
                      {profile.firstName?.[0]}{profile.lastName?.[0]}
                    </div>}
              </div>
              <button onClick={() => setShowImgModal(true)}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-lg flex items-center justify-center shadow-md hover:scale-110 transition-transform">
                <Camera className="w-3 h-3 text-primary" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-extrabold text-white leading-tight">
                {profile.firstName || user?.firstName} {profile.lastName || user?.lastName}
              </h1>
              <p className="text-white/70 text-xs truncate">{user?.email}</p>
              <span className="inline-flex items-center mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
            <div className="shrink-0 text-right hidden sm:block">
              <p className="text-white/60 text-[11px]">Last updated</p>
              <p className="text-white/90 text-xs font-semibold">Today</p>
            </div>
          </div>
        </div>

        <div className="flex gap-5">

          {/* ── Left: Tab nav ── */}
          <div className="shrink-0 w-44 space-y-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 text-left',
                  tab === t.id
                    ? 'gradient-brand text-white shadow-brand'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}>
                <t.icon className="w-4 h-4 shrink-0" />
                {t.label}
              </button>
            ))}

            {/* Account info card */}
            <div className="mt-4 bg-muted/60 rounded-xl p-3 border border-border/40 space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Account</p>
              <div>
                <p className="text-[10px] text-muted-foreground">Email</p>
                <p className="text-xs font-semibold truncate">{user?.email}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Role</p>
                <p className="text-xs font-semibold">{user?.role?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          {/* ── Right: Content ── */}
          <div className="flex-1 min-w-0">

            {/* ══ PROFILE ══════════════════════════════════════════════════════ */}
            {tab === 'profile' && (
              <div className="space-y-4 animate-slide-up">

                {/* Basic Information — read-only, click to edit */}
                <button onClick={() => setShowEditProfile(true)}
                  className="w-full text-left bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-200 group">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30 bg-gradient-to-r from-primary/5 to-transparent">
                    <div className="w-7 h-7 gradient-brand rounded-lg flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-white" />
                    </div>
                    <h3 className="font-bold text-sm flex-1">Basic Information</h3>
                    <span className="flex items-center gap-1 text-xs text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      <Pencil className="w-3 h-3" /> Edit
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border/30">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted border-2 border-border/60 shrink-0">
                        {profile.avatar
                          ? <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                          : <div className="w-full h-full gradient-brand flex items-center justify-center text-white font-extrabold text-lg">
                              {profile.firstName?.[0]}{profile.lastName?.[0]}
                            </div>}
                      </div>
                      <div>
                        <p className="font-bold text-base">{profile.firstName} {profile.lastName}</p>
                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                        {profile.gender && <p className="text-xs text-muted-foreground mt-0.5">{profile.gender}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Date of Birth</p>
                        <p className="font-medium">{profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }) : <span className="text-muted-foreground/50 italic text-xs">Not set</span>}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Phone</p>
                        <p className="font-medium">{composePhone(profile.phoneCode, profile.phone) || <span className="text-muted-foreground/50 italic text-xs">Not set</span>}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Emergency Contact</p>
                        <p className="font-medium">{composePhone(profile.emergencyCode, profile.emergencyContact) || <span className="text-muted-foreground/50 italic text-xs">Not set</span>}</p>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Address — read-only, click to edit */}
                <button onClick={() => setShowEditProfile(true)}
                  className="w-full text-left bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden hover:border-green-400/40 hover:shadow-lg transition-all duration-200 group">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30 bg-gradient-to-r from-green-500/5 to-transparent">
                    <div className="w-7 h-7 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <MapPin className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <h3 className="font-bold text-sm flex-1">Address</h3>
                    <span className="flex items-center gap-1 text-xs text-green-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      <Pencil className="w-3 h-3" /> Edit
                    </span>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Street Address</p>
                      <p className="font-medium">{profile.address || <span className="text-muted-foreground/50 italic text-xs">Not set</span>}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Country</p>
                      <p className="font-medium">{profile.country || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Pincode / ZIP</p>
                      <p className="font-medium">{profile.pincode || <span className="text-muted-foreground/50 italic text-xs">Not set</span>}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">State / Province</p>
                      <p className="font-medium">{profile.state || <span className="text-muted-foreground/50 italic text-xs">Not set</span>}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">District / City</p>
                      <p className="font-medium">{profile.city || <span className="text-muted-foreground/50 italic text-xs">Not set</span>}</p>
                    </div>
                  </div>
                </button>

              </div>
            )}

            {/* ══ TRAINER ══════════════════════════════════════════════════════ */}
            {tab === 'trainer' && isTrainer && (
              <div className="space-y-4 animate-slide-up">

                {/* Admin-only notice banner */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
                  <div className="w-8 h-8 bg-amber-100 dark:bg-amber-800/40 rounded-xl flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Admin Managed</p>
                    <p className="text-xs text-amber-600/80 dark:text-amber-500">These details can only be edited by your gym administrator.</p>
                  </div>
                </div>

                {/* Professional Info — read-only */}
                <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30 bg-gradient-to-r from-purple-500/5 to-transparent">
                    <div className="w-7 h-7 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <Dumbbell className="w-3.5 h-3.5 text-purple-600" />
                    </div>
                    <h3 className="font-bold text-sm">Professional Info</h3>
                    <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/40 px-2 py-0.5 rounded-full">
                      <Lock className="w-2.5 h-2.5" /> Read only
                    </span>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted/40 rounded-xl px-4 py-3 border border-border/40">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Years of Experience</p>
                        <p className="text-lg font-extrabold text-foreground">{trainerForm.experience ?? 0} <span className="text-sm font-medium text-muted-foreground">yrs</span></p>
                      </div>
                      <div className="bg-muted/40 rounded-xl px-4 py-3 border border-border/40">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">Hourly Rate</p>
                        <p className="text-lg font-extrabold text-foreground">
                          {trainerForm.hourlyRate ? <>₹{trainerForm.hourlyRate}</> : <span className="text-sm text-muted-foreground/50 italic font-medium">Not set</span>}
                        </p>
                      </div>
                    </div>
                    <div className="bg-muted/40 rounded-xl px-4 py-3 border border-border/40">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Bio</p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {trainerForm.bio || <span className="text-muted-foreground/50 italic">No bio added yet</span>}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Specializations — read-only */}
                <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30 bg-gradient-to-r from-teal-500/5 to-transparent">
                    <div className="w-7 h-7 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    </div>
                    <h3 className="font-bold text-sm">Specializations</h3>
                    {trainerForm.specializations.length > 0 && (
                      <span className="ml-auto text-[10px] font-bold bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-2 py-0.5 rounded-full">
                        {trainerForm.specializations.length} active
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    {trainerForm.specializations.length === 0 ? (
                      <p className="text-xs text-muted-foreground/50 italic py-2">No specializations assigned</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {trainerForm.specializations.map(s => (
                          <span key={s} className="text-xs font-semibold px-3 py-1.5 rounded-full gradient-brand text-white shadow-sm">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Certifications — read-only */}
                <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30 bg-gradient-to-r from-amber-500/5 to-transparent">
                    <div className="w-7 h-7 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <h3 className="font-bold text-sm">Certifications</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {trainerForm.certifications.length === 0 ? (
                      <p className="text-xs text-muted-foreground/50 italic py-1">No certifications added</p>
                    ) : (
                      trainerForm.certifications.map((cert, i) => (
                        <div key={i} className="flex items-center gap-2.5 bg-muted/40 rounded-xl px-3 py-2.5 border border-border/40">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          <span className="text-xs font-medium">{cert}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* ══ SECURITY ═════════════════════════════════════════════════════ */}
            {tab === 'security' && (
              <div className="space-y-4 animate-slide-up">

                <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30 bg-gradient-to-r from-rose-500/5 to-transparent">
                    <div className="w-7 h-7 bg-rose-100 dark:bg-rose-900/30 rounded-lg flex items-center justify-center">
                      <Lock className="w-3.5 h-3.5 text-rose-600" />
                    </div>
                    <h3 className="font-bold text-sm">Change Password</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {[
                      { label: 'Current Password', key: 'current' as const },
                      { label: 'New Password',     key: 'newPw'   as const },
                      { label: 'Confirm New',      key: 'confirm' as const },
                    ].map(({ label, key }) => (
                      <Field key={key} label={label}>
                        <div className="relative">
                          <input type={showPw[key] ? 'text' : 'password'} value={pwForm[key]}
                            onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                            placeholder="••••••••" className={inp + ' pr-10'} />
                          <button type="button" onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                            {showPw[key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </Field>
                    ))}

                    {pwForm.newPw.length > 0 && pwForm.newPw.length < 8 && (
                      <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800/40">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> At least 8 characters required
                      </div>
                    )}
                    {pwForm.newPw && pwForm.confirm && pwForm.newPw !== pwForm.confirm && (
                      <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 px-3 py-2 rounded-lg border border-destructive/20">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Passwords do not match
                      </div>
                    )}
                    {pwForm.newPw && pwForm.confirm && pwForm.newPw === pwForm.confirm && pwForm.newPw.length >= 8 && (
                      <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-lg border border-green-200 dark:border-green-800/40">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Ready to update
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={changePassword} disabled={saving}
                    className="flex items-center gap-2 gradient-brand text-white font-bold px-6 py-2.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-brand disabled:opacity-50 text-sm">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    {saving ? 'Updating…' : 'Change Password'}
                  </button>
                </div>
              </div>
            )}

            {tab === 'gym' && (
              <div className="space-y-6">
                {/* Renewal Reminders Card */}
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                      <Bell className="w-5 h-5 text-brand" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">Renewal Reminders</h3>
                      <p className="text-xs text-muted-foreground">Auto-email members at 30, 14, 7, 3, and 1 day before expiry</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      {reminderSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                      <button
                        onClick={() => toggleReminders(!remindersEnabled)}
                        disabled={reminderSaving}
                        className={cn(
                          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
                          remindersEnabled ? 'bg-brand' : 'bg-muted'
                        )}
                      >
                        <span className={cn(
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow',
                          remindersEnabled ? 'translate-x-6' : 'translate-x-1'
                        )} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When enabled, the system automatically sends personalized renewal reminder emails and in-app notifications to members whose memberships are expiring soon.
                  </p>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={loadReminderPreview}
                      disabled={previewLoading}
                      className="flex items-center gap-2 border border-border rounded-xl px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
                    >
                      {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                      Preview Today's Reminders
                    </button>
                    <button
                      onClick={sendRemindersNow}
                      className="flex items-center gap-2 gradient-brand text-white rounded-xl px-4 py-2 text-sm font-bold hover:opacity-90 transition-all"
                    >
                      <Send className="w-4 h-4" />
                      Send Now
                    </button>
                  </div>
                  {reminderPreview.length > 0 && (
                    <div className="mt-3 border border-border rounded-xl overflow-hidden">
                      <div className="bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Members receiving reminders today ({reminderPreview.length})
                      </div>
                      <div className="divide-y divide-border">
                        {reminderPreview.map((m: any, i: number) => (
                          <div key={i} className="px-4 py-3 flex items-center justify-between text-sm">
                            <div>
                              <p className="font-medium">{m.memberName}</p>
                              <p className="text-xs text-muted-foreground">{m.email}</p>
                            </div>
                            <div className="text-right">
                              <span className={cn(
                                'text-xs font-bold px-2 py-1 rounded-full',
                                m.daysLeft <= 3 ? 'bg-red-100 text-red-700' : m.daysLeft <= 7 ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                              )}>
                                {m.daysLeft} day{m.daysLeft === 1 ? '' : 's'} left
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {reminderPreview.length === 0 && !previewLoading && reminderPreview !== null && (
                    <p className="text-xs text-muted-foreground italic">Click "Preview" to see who would receive reminders today.</p>
                  )}
                </div>
              </div>
            )}

            {/* ══ NOTIFICATIONS ═══════════════════════════════════════════════ */}
            {tab === 'notifications' && (
              <div className="space-y-4 animate-slide-up">
                <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30 bg-gradient-to-r from-blue-500/5 to-transparent">
                    <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <Bell className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">Notification Preferences</h3>
                      <p className="text-xs text-muted-foreground">Control what alerts you receive</p>
                    </div>
                  </div>
                  <div className="divide-y divide-border/40">
                    {[
                      { label: 'Membership Expiry Reminders', desc: 'Get notified before your membership expires' },
                      { label: 'Payment Confirmations', desc: 'Receive receipts for successful payments' },
                      { label: 'PT Session Reminders', desc: '30 minutes before your training session' },
                      { label: 'New Supplement Arrivals', desc: 'When new products are added to the store' },
                      { label: 'Workout Suggestions', desc: 'Daily AI-powered workout tips' },
                    ].map(({ label, desc }) => (
                      <div key={label} className="flex items-center justify-between px-4 py-4 hover:bg-muted/20 transition-colors">
                        <div>
                          <p className="font-semibold text-sm">{label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                          <input type="checkbox" defaultChecked className="sr-only peer" />
                          <div className="w-10 h-6 bg-muted rounded-full peer peer-checked:bg-primary transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
