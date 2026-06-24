'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Users, Plus, Search, UserCheck, UserX, Phone, Mail, Crown, Calendar,
  MoreVertical, X, Eye, EyeOff, Edit2, RefreshCw, UserCircle, Shield,
  Hash, CheckCircle, XCircle, Trash2, ArrowLeft, Send, Dumbbell, Star,
  TrendingUp, Briefcase, UserPlus, Pencil, Save, Loader2, Camera, Upload,
  DollarSign, CreditCard, Tag, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { usersApi, membershipsApi, authApi, trainersApi, staffsApi, membershipPlansApi } from '@/lib/api';
import { formatDate, getInitials, getMembershipBadgeColor } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { StatsCard } from '@/components/shared/StatsCard';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

/* ─── constants ─────────────────────────────────────────── */
const GRADS   = ['gradient-brand','gradient-blue','gradient-purple','gradient-green','gradient-teal','gradient-rose'];
const SPECS   = ['Weight Training','Cardio','Yoga','CrossFit','Nutrition','Boxing','Pilates','Zumba','Functional Training','Swimming'];
const DEPTS   = ['Reception','Housekeeping','Security','Management','IT Support','Marketing','Finance','Maintenance'];
const DEPT_CL: Record<string,string> = {
  Reception:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Housekeeping:'bg-green-100 text-green-700',Security:'bg-red-100 text-red-700',
  Management:'bg-purple-100 text-purple-700',
  'IT Support':'bg-cyan-100 text-cyan-700',Marketing:'bg-pink-100 text-pink-700',
  Finance:'bg-amber-100 text-amber-700',Maintenance:'bg-orange-100 text-orange-700',
};
const MP: Record<string,number> = { MONTHLY:999, QUARTERLY:2699, HALF_YEARLY:4999, YEARLY:8999 };

/* ─── tiny helpers ───────────────────────────────────────── */
const inp = 'w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const Avatar = ({ src, first='', last='', size=10, grad='gradient-brand' }: any) => (
  <div className={`w-${size} h-${size} ${grad} rounded-2xl overflow-hidden flex items-center justify-center text-white font-extrabold text-sm shrink-0`}>
    {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : getInitials(first, last)}
  </div>
);

/* ─── shared OTP verify panel ────────────────────────────── */
function OtpPanel({ email, accent='blue', onVerified, onBack }: {
  email: string; accent?: string;
  onVerified: () => void; onBack: () => void;
}) {
  const [otp, setOtp] = useState(['','','','','','']);
  const [err, setErr] = useState(false);
  const [checking, setChecking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);
  const refs = useRef<(HTMLInputElement|null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const handleInput = (i: number, v: string) => {
    if (v.length > 1) {
      const digits = v.replace(/\D/g,'').slice(0,6);
      const next = [...otp]; digits.split('').forEach((d,j) => { if (j<6) next[j]=d; });
      setOtp(next); refs.current[Math.min(digits.length,5)]?.focus(); return;
    }
    const d = v.replace(/\D/g,''); const next=[...otp]; next[i]=d; setOtp(next); setErr(false);
    if (d && i < 5) refs.current[i+1]?.focus();
  };
  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key==='Backspace' && !otp[i] && i>0) refs.current[i-1]?.focus();
  };
  const verify = async () => {
    if (otp.join('').length < 6) { setErr(true); return; }
    setChecking(true);
    try { await authApi.checkOtp(email, otp.join('')); setSuccess(true); setTimeout(onVerified, 700); }
    catch { setErr(true); setOtp(['','','','','','']); refs.current[0]?.focus(); }
    setChecking(false);
  };
  const resend = async () => {
    if (countdown > 0) return;
    setResending(true);
    try { await authApi.sendOtp(email, ''); setCountdown(60); setOtp(['','','','','','']); setErr(false); toast.success('OTP resent!'); refs.current[0]?.focus(); }
    catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed'); }
    setResending(false);
  };

  const accentMap: Record<string,string> = { blue:'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 scale-105', purple:'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 scale-105', teal:'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 scale-105' };
  const filledCls = accentMap[accent] ?? accentMap.blue;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col items-center pt-2">
        <div className={cn('relative w-20 h-20 rounded-3xl flex items-center justify-center mb-4 transition-all duration-500', success ? 'gradient-green' : `gradient-${accent}`)}>
          {success ? <CheckCircle className="w-9 h-9 text-white animate-pop" /> : <Mail className="w-9 h-9 text-white" />}
          {!success && <><div className="absolute -top-1 -right-1 w-5 h-5 gradient-brand rounded-full animate-live-ping opacity-50" /><div className="absolute -top-1 -right-1 w-5 h-5 gradient-brand rounded-full flex items-center justify-center"><span className="text-white text-[10px] font-black">!</span></div></>}
        </div>
        <h3 className="font-extrabold text-lg">{success ? 'Email Verified!' : 'Check Your Inbox'}</h3>
        <p className="text-sm text-muted-foreground text-center mt-1">
          {success ? 'Verified successfully' : <>OTP sent to <span className="font-bold text-foreground">{email}</span></>}
        </p>
      </div>
      {!success && (
        <>
          <div className={cn('flex items-center justify-center gap-2', err ? 'animate-shake' : '')}>
            {otp.map((d,i) => (
              <input key={i} ref={el => { refs.current[i]=el; }} type="text" inputMode="numeric" maxLength={6}
                value={d} onChange={e => handleInput(i,e.target.value)} onKeyDown={e => handleKey(i,e)}
                className={cn('w-12 h-14 text-center text-2xl font-extrabold rounded-2xl border-2 outline-none transition-all duration-200',
                  d ? filledCls : 'border-border bg-muted/50 focus:border-primary/50',
                  err && 'border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-600')} />
            ))}
          </div>
          {err && <p className="text-center text-sm font-semibold text-rose-500">Invalid OTP — try again.</p>}
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5"/> Back</button>
            {countdown > 0
              ? <p className="text-sm text-muted-foreground">Resend in <span className="font-bold tabular-nums">{countdown}s</span></p>
              : <button onClick={resend} disabled={resending} className="text-sm font-bold text-primary hover:text-primary/80 disabled:opacity-50">{resending ? 'Sending…' : 'Resend OTP'}</button>}
          </div>
          <button onClick={verify} disabled={checking || otp.join('').length < 6}
            className={cn('w-full py-2.5 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2', `gradient-${accent}`)}>
            {checking ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Verify
          </button>
        </>
      )}
    </div>
  );
}

/* ─── shared confirm-remove ──────────────────────────────── */
function RemoveConfirm({ title, name, onConfirm, onClose, removing }: any) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm animate-pop p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-rose-100 dark:bg-rose-900/30 rounded-xl flex items-center justify-center shrink-0"><Trash2 className="w-5 h-5 text-rose-600" /></div>
          <div><h3 className="font-extrabold text-base">{title}</h3><p className="text-xs text-muted-foreground mt-0.5">This will permanently delete the account.</p></div>
        </div>
        <p className="text-sm text-muted-foreground bg-muted/50 rounded-xl px-4 py-3">Removing <strong className="text-foreground">{name}</strong>. Cannot be undone.</p>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} disabled={removing} className="flex-1 py-2.5 rounded-xl border-2 border-border hover:bg-muted text-sm font-bold transition-all disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={removing} className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-extrabold flex items-center justify-center gap-2 disabled:opacity-60">
            {removing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {removing ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MEMBERS
═══════════════════════════════════════════════════════════ */
function AddMemberModal({ onClose, onSuccess, plans = [] }: any) {
  const [step, setStep] = useState<1|2|3>(1);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', phone:'', password:'' });
  const [membership, setMembership] = useState({ enabled:false, type:'MONTHLY', price:999, startDate: new Date().toISOString().split('T')[0] });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]:v }));
  const pw = form.password;
  const pwScore = [pw.length>=8,/[A-Z]/.test(pw),/[0-9]/.test(pw),/[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
  const endDate = () => { const d=new Date(membership.startDate); ({MONTHLY:()=>d.setMonth(d.getMonth()+1),QUARTERLY:()=>d.setMonth(d.getMonth()+3),HALF_YEARLY:()=>d.setMonth(d.getMonth()+6),YEARLY:()=>d.setFullYear(d.getFullYear()+1)} as any)[membership.type]?.(); return d.toISOString().split('T')[0]; };

  const sendOtp = async () => {
    if (!form.firstName||!form.email||!form.password) { toast.error('First name, email and password required'); return; }
    if (form.password.length<8) { toast.error('Password must be ≥8 chars'); return; }
    setOtpSending(true);
    try { await authApi.sendOtp(form.email, form.firstName); setStep(2); }
    catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed to send OTP'); }
    setOtpSending(false);
  };
  const submit = async () => {
    setSaving(true);
    try {
      const user: any = await usersApi.create({ ...form });
      if (membership.enabled && user?.id) await membershipsApi.create({ userId:user.id, type:membership.type, amount:membership.price, startDate:new Date(membership.startDate).toISOString(), endDate:new Date(endDate()).toISOString() });
      toast.success(`${form.firstName} added!`); onSuccess(); onClose();
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed'); }
    setSaving(false);
  };

  const stepGrads = ['gradient-brand','gradient-blue','gradient-green'];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-pop">
        <div className={`${stepGrads[step-1]} p-5 relative overflow-hidden transition-all duration-700`}>
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              {step>1 && <button onClick={()=>setStep(s=>(s-1)as any)} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><ArrowLeft className="w-4 h-4"/></button>}
              <div><h2 className="font-extrabold text-xl text-white">Add Member</h2>
              <p className="text-sm text-white/70">{step===1?'Personal details':step===2?'Verify email':'Assign membership'}</p></div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><X className="w-4 h-4"/></button>
          </div>
          <div className="flex items-center gap-2 mt-4">
            {[1,2,3].map(s=>(
              <div key={s} className="flex items-center gap-2">
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',step>s?'bg-white text-emerald-600':step===s?'bg-white text-gray-900':'bg-white/20 text-white/60')}>
                  {step>s?<CheckCircle className="w-4 h-4"/>:s}
                </div>
                {s<3&&<div className={cn('h-0.5 w-8 rounded-full transition-all',step>s?'bg-white':'bg-white/25')}/>}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[55vh] overflow-y-auto scrollbar-hide">
          {step===1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-3">
                {[{k:'firstName',l:'First Name *',p:'John'},{k:'lastName',l:'Last Name',p:'Doe'}].map(({k,l,p})=>(
                  <div key={k} className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{l}</label>
                  <input value={(form as any)[k]} onChange={e=>set(k,e.target.value)} placeholder={p} className={inp}/></div>
                ))}
              </div>
              <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Email *</label>
                <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"/>
                  <input type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="john@example.com" className={inp+' pl-9'}/></div>
              </div>
              <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Phone</label>
                <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"/>
                  <input type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+91 9876543210" className={inp+' pl-9'}/></div>
              </div>
              <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Password *</label>
                <div className="relative">
                  <input type={showPass?'text':'password'} value={form.password} onChange={e=>set('password',e.target.value)} placeholder="Min 8 characters" className={inp+' pr-10'}/>
                  <button type="button" onClick={()=>setShowPass(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPass?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button>
                </div>
                {pw.length>0&&<div className="space-y-1"><div className="flex gap-1">{[1,2,3,4].map(i=><div key={i} className={cn('h-1 flex-1 rounded-full',i<=pwScore?['bg-rose-500','bg-orange-500','bg-amber-400','bg-emerald-500'][pwScore-1]:'bg-muted')}/>)}</div><p className={cn('text-xs font-semibold',pwScore<=1?'text-rose-500':pwScore===2?'text-orange-500':pwScore===3?'text-amber-500':'text-emerald-500')}>{['Too weak','Weak','Good','Strong'][pwScore-1]??'Too weak'}</p></div>}
              </div>
            </div>
          )}
          {step===2 && <OtpPanel email={form.email} accent="blue" onVerified={()=>{setEmailVerified(true);setStep(3);}} onBack={()=>setStep(1)}/>}
          {step===3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 rounded-xl">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0"/>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{form.email} verified</p>
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/40 rounded-2xl border border-border/60">
                <div><p className="font-bold">Assign Membership</p><p className="text-xs text-muted-foreground">Optional — grant gym access</p></div>
                <button onClick={()=>setMembership(m=>({...m,enabled:!m.enabled}))} className={cn('relative w-11 h-6 rounded-full transition-colors',membership.enabled?'gradient-brand':'bg-muted-foreground/30')}>
                  <span className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',membership.enabled?'translate-x-5':'translate-x-0.5')}/>
                </button>
              </div>
              {membership.enabled&&(
                <div className="space-y-3 animate-fade-in">
                  <div className="grid grid-cols-2 gap-2">
                    {(['MONTHLY','QUARTERLY','HALF_YEARLY','YEARLY']as const).map(t=>{
                      const dbPlan = plans.find((p:any)=>p.type===t);
                      const price = dbPlan?.price ?? MP[t];
                      return (
                        <button key={t} onClick={()=>setMembership(m=>({...m,type:t,price}))} className={cn('p-3 rounded-xl border text-left transition-all',membership.type===t?'border-primary/50 gradient-brand text-white':'border-border bg-card hover:bg-muted')}>
                          <p className="text-xs font-bold">{t.replace(/_/g,' ')}</p>
                          <p className={cn('text-sm font-extrabold mt-0.5',membership.type===t?'text-white':'text-primary')}>₹{price.toLocaleString()}</p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Price (₹)</label><input type="number" value={membership.price} onChange={e=>setMembership(m=>({...m,price:+e.target.value}))} className={inp}/></div>
                    <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Start</label><input type="date" value={membership.startDate} onChange={e=>setMembership(m=>({...m,startDate:e.target.value}))} className={inp}/></div>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 rounded-xl"><p className="text-xs font-bold text-emerald-700">Expires: {new Date(endDate()).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</p></div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-5 border-t border-border">
          <button onClick={step===1?onClose:()=>setStep(s=>(s-1)as any)} className="px-5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium flex items-center gap-2">{step>1&&<ArrowLeft className="w-4 h-4"/>}{step===1?'Cancel':'Back'}</button>
          {step===1&&<button onClick={sendOtp} disabled={otpSending} className="px-6 py-2.5 rounded-xl gradient-brand text-white font-bold text-sm disabled:opacity-60 flex items-center gap-2">{otpSending?<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<Send className="w-4 h-4"/>}Send OTP</button>}
          {step===3&&<button onClick={submit} disabled={saving} className="px-6 py-2.5 rounded-xl gradient-green text-white font-bold text-sm disabled:opacity-60 flex items-center gap-2">{saving&&<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}Add Member</button>}
        </div>
      </div>
    </div>
  );
}

function EditMemberModal({ member, onClose, onSuccess }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName:member.firstName??'', lastName:member.lastName??'', email:member.email??'', phone:member.phone??'' });
  const save = async () => {
    if (!form.firstName||!form.email) { toast.error('First name and email required'); return; }
    setSaving(true);
    try { await usersApi.update(member.id,form); toast.success('Member updated'); onSuccess(); onClose(); }
    catch (e: any) { toast.error(e.response?.data?.message??'Failed'); }
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl gradient-blue flex items-center justify-center"><Edit2 className="w-4 h-4 text-white"/></div><div><h2 className="font-extrabold text-lg">Edit Member</h2><p className="text-xs text-muted-foreground">{member.firstName} {member.lastName}</p></div></div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[{k:'firstName',l:'First Name *',p:'John'},{k:'lastName',l:'Last Name',p:'Doe'}].map(({k,l,p})=>(
              <div key={k} className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{l}</label><input value={(form as any)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder={p} className={inp}/></div>
            ))}
          </div>
          <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Email *</label><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className={inp}/></div>
          <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Phone</label><input type="tel" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className={inp}/></div>
        </div>
        <div className="flex gap-2 p-6 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl gradient-blue text-white font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2">{saving&&<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}Save</button>
        </div>
      </div>
    </div>
  );
}

function RenewModal({ member, onClose, onSuccess, plans = [] }: any) {
  const ex = member.memberships?.[0];
  const [saving, setSaving] = useState(false);
  const defaultType = ex?.plan?.type??ex?.type??'MONTHLY';
  const defaultPlanDb = plans.find((p:any)=>p.type===defaultType);
  const [plan, setPlan] = useState({ type: defaultType, price: ex?.amount ?? defaultPlanDb?.price ?? MP.MONTHLY, startDate: new Date().toISOString().split('T')[0] });
  const endDate = () => { const d=new Date(plan.startDate); ({MONTHLY:()=>d.setMonth(d.getMonth()+1),QUARTERLY:()=>d.setMonth(d.getMonth()+3),HALF_YEARLY:()=>d.setMonth(d.getMonth()+6),YEARLY:()=>d.setFullYear(d.getFullYear()+1)} as any)[plan.type]?.(); return d.toISOString().split('T')[0]; };
  const save = async () => {
    setSaving(true);
    try {
      if (ex) await membershipsApi.update(ex.id,{ amount:plan.price, startDate:new Date(plan.startDate).toISOString(), endDate:new Date(endDate()).toISOString(), status:'ACTIVE' });
      else await membershipsApi.create({ userId:member.id, type:plan.type, amount:plan.price, startDate:new Date(plan.startDate).toISOString(), endDate:new Date(endDate()).toISOString() });
      toast.success('Membership renewed!'); onSuccess(); onClose();
    } catch (e: any) { toast.error(e.response?.data?.message??'Failed'); }
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl gradient-green flex items-center justify-center"><RefreshCw className="w-4 h-4 text-white"/></div><div><h2 className="font-extrabold text-lg">Renew Membership</h2><p className="text-xs text-muted-foreground">{member.firstName} {member.lastName}</p></div></div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-6 space-y-4">
          {ex&&<div className="p-3 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 rounded-xl"><p className="text-xs font-bold text-amber-700">Current: {ex.plan?.type??ex.type} — expires {formatDate(ex.endDate)}</p></div>}
          <div className="grid grid-cols-2 gap-2">
            {(['MONTHLY','QUARTERLY','HALF_YEARLY','YEARLY']as const).map(t=>{
              const dbPlan = plans.find((p:any)=>p.type===t);
              const price = dbPlan?.price ?? MP[t];
              return (
                <button key={t} onClick={()=>setPlan(p=>({...p,type:t,price}))} className={cn('p-3 rounded-xl border text-left transition-all',plan.type===t?'border-primary/50 gradient-brand text-white':'border-border bg-card hover:bg-muted')}>
                  <p className="text-xs font-bold">{t.replace(/_/g,' ')}</p><p className={cn('text-sm font-extrabold mt-0.5',plan.type===t?'text-white':'text-primary')}>₹{price.toLocaleString()}</p>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Price (₹)</label><input type="number" value={plan.price} onChange={e=>setPlan(p=>({...p,price:+e.target.value}))} className={inp}/></div>
            <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Start</label><input type="date" value={plan.startDate} onChange={e=>setPlan(p=>({...p,startDate:e.target.value}))} className={inp}/></div>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 rounded-xl flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-600"/><p className="text-xs font-bold text-emerald-700">Expires: {new Date(endDate()).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</p></div>
        </div>
        <div className="flex gap-2 p-6 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl gradient-green text-white font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2">{saving&&<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}<RefreshCw className="w-4 h-4"/>{ex?'Renew':'Assign'}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Members tab content ─────────────────────────────────── */
function MembersTab() {
  const { user: currentUser } = useAuthStore();
  const [members, setMembers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [activeMenu, setActiveMenu] = useState<string|null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [modal, setModal] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);

  const fetch = async () => {
    setLoading(true);
    try {
      const [res,st]: any[] = await Promise.all([usersApi.getAll({page,limit:12,search,role:'MEMBER'}),usersApi.getStats().catch(()=>null)]);
      setMembers(res.data??[]); setTotal(res.total??0); if(st) setStats(st);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { membershipPlansApi.getAll().then((r:any)=>setPlans(r.data??r??[])).catch(()=>{}); }, []);
  useEffect(() => { fetch(); }, [page]);
  useEffect(() => { const t=setTimeout(fetch,400); return ()=>clearTimeout(t); }, [search]);

  const statCards = [
    { title:'Total Members', value:stats?.total??total, icon:Users, gradient:'blue' as const },
    { title:'Active', value:stats?.active??0, icon:UserCheck, gradient:'green' as const },
    { title:'New This Month', value:stats?.newThisMonth??0, icon:Crown, gradient:'orange' as const },
    { title:'Expiring Soon', value:stats?.expiringSoon??0, icon:UserX, gradient:'rose' as const },
  ];

  const Menu = ({ m }: { m: any }) => (
    <div className="relative">
      <button onClick={()=>setActiveMenu(activeMenu===m.id?null:m.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><MoreVertical className="w-4 h-4"/></button>
      {activeMenu===m.id&&(
        <><div className="fixed inset-0 z-10" onClick={()=>setActiveMenu(null)}/>
        <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-xl shadow-lifted z-20 overflow-hidden animate-scale-in">
          {[{icon:UserCircle,label:'View Profile',action:()=>setModal({type:'profile',m})},{icon:Edit2,label:'Edit Details',action:()=>setModal({type:'edit',m})},{icon:RefreshCw,label:m.memberships?.length>0?'Renew Membership':'Assign Membership',action:()=>setModal({type:'renew',m})}].map(({icon:I,label,action})=>(
            <button key={label} onClick={action} className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2.5"><I className="w-4 h-4 text-muted-foreground"/>{label}</button>
          ))}
          <div className="border-t border-border/50 my-1"/>
          <button onClick={()=>setModal({type:'toggle',m})} className={cn('w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5',m.isActive?'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/15':'text-emerald-600 hover:bg-emerald-50')}>
            {m.isActive?<><XCircle className="w-4 h-4"/>Deactivate</>:<><CheckCircle className="w-4 h-4"/>Activate</>}
          </button>
          <button onClick={()=>setModal({type:'remove',m})} className="w-full px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/15 flex items-center gap-2.5"><Trash2 className="w-4 h-4"/>Remove</button>
        </div></>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Modals */}
      {showAdd&&<AddMemberModal onClose={()=>setShowAdd(false)} onSuccess={fetch} plans={plans}/>}
      {modal?.type==='edit'&&<EditMemberModal member={modal.m} onClose={()=>setModal(null)} onSuccess={fetch}/>}
      {modal?.type==='renew'&&<RenewModal member={modal.m} onClose={()=>setModal(null)} onSuccess={fetch} plans={plans}/>}
      {modal?.type==='toggle'&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm animate-scale-in p-6 text-center">
            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4',modal.m.isActive?'bg-rose-100 dark:bg-rose-900/30':'bg-emerald-100 dark:bg-emerald-900/30')}>
              {modal.m.isActive?<XCircle className="w-7 h-7 text-rose-600"/>:<CheckCircle className="w-7 h-7 text-emerald-600"/>}
            </div>
            <h2 className="text-lg font-extrabold mb-1">{modal.m.isActive?'Deactivate':'Activate'} Member?</h2>
            <p className="text-sm text-muted-foreground mb-4">{modal.m.firstName} {modal.m.lastName}</p>
            <div className="flex gap-2">
              <button onClick={()=>setModal(null)} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium">Cancel</button>
              <button onClick={async()=>{try{if(modal.m.isActive)await usersApi.deactivate(modal.m.id);else await usersApi.activate(modal.m.id);toast.success(modal.m.isActive?'Deactivated':'Activated');fetch();}catch{}setModal(null);}}
                className={cn('flex-1 py-2.5 rounded-xl text-white font-bold text-sm',modal.m.isActive?'bg-rose-600 hover:bg-rose-700':'gradient-green hover:opacity-90')}>
                {modal.m.isActive?'Deactivate':'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
      {modal?.type==='remove'&&(
        <RemoveConfirm title="Remove Member?" name={`${modal.m.firstName} ${modal.m.lastName}`} removing={false}
          onClose={()=>setModal(null)} onConfirm={async()=>{try{await usersApi.remove(modal.m.id);toast.success('Removed');fetch();}catch{}setModal(null);}}/>
      )}
      {modal?.type==='profile'&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md animate-scale-in overflow-hidden">
            <div className={`h-20 gradient-brand relative`}><button onClick={()=>setModal(null)} className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white"><X className="w-4 h-4"/></button></div>
            <div className="px-6 -mt-8 pb-0"><div className="w-16 h-16 gradient-brand rounded-2xl overflow-hidden shadow-lg border-2 border-card flex items-center justify-center text-white font-extrabold text-xl">{modal.m.avatar?<img src={modal.m.avatar} alt="av" className="w-full h-full object-cover"/>:getInitials(modal.m.firstName,modal.m.lastName)}</div></div>
            <div className="px-6 py-3"><h2 className="text-xl font-extrabold">{modal.m.firstName} {modal.m.lastName}</h2>{modal.m.memberCode&&<p className="text-xs font-mono text-primary font-bold">#{modal.m.memberCode}</p>}</div>
            <div className="px-6 pb-4 space-y-1">
              {[{I:Mail,l:'Email',v:modal.m.email},{I:Phone,l:'Phone',v:modal.m.phone},{I:Hash,l:'Member Code',v:modal.m.memberCode},{I:Calendar,l:'Joined',v:formatDate(modal.m.createdAt, currentUser?.timezone)}].map(({I,l,v})=>(
                <div key={l} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center"><I className="w-3.5 h-3.5 text-muted-foreground"/></div>
                  <div><p className="text-xs text-muted-foreground">{l}</p><p className="text-sm font-semibold">{v||'—'}</p></div>
                </div>
              ))}
            </div>
            <div className="px-6 pb-5"><button onClick={()=>setModal(null)} className="w-full py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium">Close</button></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{statCards.map(s=><StatsCard key={s.title} {...s}/>)}</div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email…" className="w-full h-10 pl-10 pr-4 text-sm bg-card border border-border/60 rounded-xl outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"/></div>
        <button onClick={()=>setShowAdd(true)} className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-brand text-white font-bold text-sm shadow-brand hover:opacity-90 transition-all"><Plus className="w-4 h-4"/> Add Member</button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{Array.from({length:6}).map((_,i)=><div key={i} className="h-44 shimmer-bg rounded-2xl"/>)}</div>
      ) : members.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center text-muted-foreground"><Users className="w-12 h-12 mx-auto mb-3 opacity-20"/><p className="font-semibold">No members yet</p><button onClick={()=>setShowAdd(true)} className="mt-4 px-5 py-2.5 rounded-xl gradient-brand text-white font-bold text-sm hover:opacity-90">Add First Member</button></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {members.map((m: any, i: number) => {
            const ms = m.memberships?.[0]; const grad = GRADS[i%GRADS.length];
            return (
              <div key={m.id} className="group relative bg-card border border-border/60 rounded-2xl hover:shadow-lifted hover:-translate-y-1 transition-all duration-300">
                <div className={`h-1.5 ${grad} rounded-t-2xl`}/>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 ${grad} rounded-2xl overflow-hidden shadow-sm flex items-center justify-center text-white font-extrabold text-base`}>{m.avatar?<img src={m.avatar} alt="av" className="w-full h-full object-cover"/>:getInitials(m.firstName,m.lastName)}</div>
                      <div><p className="font-bold leading-tight">{m.firstName} {m.lastName}</p><p className="text-xs font-mono text-primary font-bold mt-0.5">{m.memberCode?`#${m.memberCode}`:'—'}</p><div className="flex items-center gap-1.5 mt-1"><div className={cn('w-1.5 h-1.5 rounded-full',m.isActive?'bg-emerald-500':'bg-rose-400')}/><span className="text-xs text-muted-foreground">{m.isActive?'Active':'Inactive'}</span></div></div>
                    </div>
                    <Menu m={m}/>
                  </div>
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="w-3.5 h-3.5 shrink-0"/><span className="truncate">{m.email}</span></div>
                    {m.phone&&<div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="w-3.5 h-3.5 shrink-0"/>{m.phone}</div>}
                  </div>
                  {ms?<div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-xl"><div className="flex items-center gap-2"><Crown className="w-3.5 h-3.5 text-amber-500"/><span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{ms.plan?.type??ms.type}</span></div><span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-emerald-500 text-white">ACTIVE</span></div>:<div className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-xl border border-dashed border-border"><Crown className="w-3.5 h-3.5 text-muted-foreground/40"/><span className="text-xs text-muted-foreground">No membership</span></div>}
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground"><Calendar className="w-3 h-3"/>Joined {formatDate(m.createdAt, currentUser?.timezone)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {total > 12 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">Showing {members.length} of {total}</p>
          <div className="flex gap-2">
            <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-4 py-2 text-sm font-medium rounded-xl border border-border bg-card hover:bg-muted disabled:opacity-40">← Prev</button>
            <button disabled={members.length<12} onClick={()=>setPage(p=>p+1)} className="px-4 py-2 text-sm font-medium rounded-xl border border-border bg-card hover:bg-muted disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TRAINERS
═══════════════════════════════════════════════════════════ */
function AddTrainerModal({ onClose, onSuccess }: any) {
  const [step, setStep] = useState<1|2>(1);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [specs, setSpecs] = useState<string[]>([]);
  const [otpSending, setOtpSending] = useState(false);
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', phone:'', password:'', experience:'', hourlyRate:'', bio:'' });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]:v }));
  const toggleSpec = (s: string) => setSpecs(p => p.includes(s)?p.filter(x=>x!==s):[...p,s]);

  const sendOtp = async () => {
    if (!form.firstName||!form.email||!form.password) { toast.error('First name, email and password required'); return; }
    if (form.password.length<8) { toast.error('Password must be ≥8 chars'); return; }
    setOtpSending(true);
    try { await authApi.sendOtp(form.email, form.firstName); setStep(2); }
    catch (e: any) { toast.error(e.response?.data?.message??'Failed'); }
    setOtpSending(false);
  };
  const create = async () => {
    setSaving(true);
    try {
      await usersApi.create({ ...form, role:'TRAINER', specializations:specs, experience:form.experience?parseInt(form.experience):0, hourlyRate:form.hourlyRate?parseFloat(form.hourlyRate):null, bio:form.bio||null });
      toast.success(`Trainer ${form.firstName} added!`); onSuccess(); onClose();
    } catch (e: any) { toast.error(e.response?.data?.message??'Failed'); setStep(1); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-pop">
        <div className={`${step===1?'gradient-purple':'gradient-blue'} p-5 relative overflow-hidden transition-all duration-700`}>
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none"/>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              {step>1&&<button onClick={()=>setStep(1)} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><ArrowLeft className="w-4 h-4"/></button>}
              <div><h2 className="font-extrabold text-xl text-white">Add Trainer</h2><p className="text-sm text-white/70">{step===1?'Trainer details':'Verify email'}</p></div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><X className="w-4 h-4"/></button>
          </div>
          <div className="flex items-center gap-2 mt-4">
            {[1,2].map(s=>(
              <div key={s} className="flex items-center gap-2">
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',step>s?'bg-white text-emerald-600':step===s?'bg-white text-gray-900':'bg-white/20 text-white/60')}>{step>s?<CheckCircle className="w-4 h-4"/>:s}</div>
                {s<2&&<div className={cn('h-0.5 w-8 rounded-full transition-all',step>s?'bg-white':'bg-white/25')}/>}
              </div>
            ))}
          </div>
        </div>
        <div className="p-6 space-y-4 max-h-[58vh] overflow-y-auto scrollbar-hide">
          {step===1&&(
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-3">
                {[{k:'firstName',l:'First Name *',p:'Jane'},{k:'lastName',l:'Last Name',p:'Smith'}].map(({k,l,p})=>(
                  <div key={k} className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{l}</label><input value={(form as any)[k]} onChange={e=>set(k,e.target.value)} placeholder={p} className={inp}/></div>
                ))}
              </div>
              <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Email *</label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"/><input type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="trainer@gym.com" className={inp+' pl-9'}/></div></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Phone</label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"/><input type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+91 9876543210" className={inp+' pl-9'}/></div></div>
                <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Password *</label><div className="relative"><input type={showPass?'text':'password'} value={form.password} onChange={e=>set('password',e.target.value)} placeholder="Min 8" className={inp+' pr-9'}/><button type="button" onClick={()=>setShowPass(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPass?<EyeOff className="w-3.5 h-3.5"/>:<Eye className="w-3.5 h-3.5"/>}</button></div></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Experience (yrs)</label><input type="number" min="0" value={form.experience} onChange={e=>set('experience',e.target.value)} placeholder="0" className={inp}/></div>
                <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Rate (₹/hr)</label><input type="number" min="0" value={form.hourlyRate} onChange={e=>set('hourlyRate',e.target.value)} placeholder="500" className={inp}/></div>
              </div>
              <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Specializations</label><div className="flex flex-wrap gap-2">{SPECS.map(s=><button key={s} type="button" onClick={()=>toggleSpec(s)} className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',specs.includes(s)?'gradient-purple text-white border-transparent':'bg-muted text-muted-foreground border-border hover:bg-muted/80')}>{s}</button>)}</div></div>
              <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Bio</label><textarea value={form.bio} onChange={e=>set('bio',e.target.value)} rows={2} placeholder="Brief background…" className="w-full px-3 py-2.5 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 resize-none"/></div>
            </div>
          )}
          {step===2&&<OtpPanel email={form.email} accent="purple" onVerified={create} onBack={()=>setStep(1)}/>}
        </div>
        <div className="flex items-center justify-between p-5 border-t border-border">
          <button onClick={step===1?onClose:()=>setStep(1)} className="px-5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium flex items-center gap-2">{step>1&&<ArrowLeft className="w-4 h-4"/>}{step===1?'Cancel':'Back'}</button>
          {step===1&&<button onClick={sendOtp} disabled={otpSending} className="px-6 py-2.5 rounded-xl gradient-purple text-white font-bold text-sm disabled:opacity-60 flex items-center gap-2">{otpSending?<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<Send className="w-4 h-4"/>}Send OTP</button>}
          {step===2&&saving&&<div className="px-6 py-2.5 rounded-xl gradient-blue text-white font-bold text-sm flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Creating…</div>}
        </div>
      </div>
    </div>
  );
}

function AssignMemberModal({ trainer, onClose, onSuccess }: any) {
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string|null>(null);
  useEffect(() => { usersApi.getAll({role:'MEMBER',limit:100}).then((res: any)=>setMembers(res.data??[])).catch(()=>{}).finally(()=>setLoading(false)); }, []);
  const filtered = search.trim() ? members.filter(m=>`${m.firstName} ${m.lastName} ${m.email}`.toLowerCase().includes(search.toLowerCase())) : members;
  const assign = async (m: any) => {
    setAssigning(m.id);
    try { await trainersApi.assignClient(trainer.id, m.id); toast.success(`${m.firstName} assigned`); onSuccess(); onClose(); }
    catch (e: any) { toast.error(e.response?.data?.message??'Failed'); }
    setAssigning(null);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md animate-scale-in overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center"><UserPlus className="w-4 h-4 text-white"/></div><div><h2 className="font-extrabold text-lg">Assign Member</h2><p className="text-xs text-muted-foreground">To {trainer.user?.firstName} {trainer.user?.lastName}</p></div></div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-4 border-b border-border/50"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search members…" className="w-full h-9 pl-9 pr-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 transition-all"/></div></div>
        <div className="max-h-72 overflow-y-auto divide-y divide-border/30">
          {loading?<div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>:filtered.length===0?<div className="p-8 text-center text-muted-foreground text-sm">No members found</div>:filtered.map((m: any)=>(
            <div key={m.id} className="flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors">
              <div className="w-9 h-9 gradient-brand rounded-xl overflow-hidden flex items-center justify-center text-white font-bold text-xs shrink-0">{m.avatar?<img src={m.avatar} alt="av" className="w-full h-full object-cover"/>:getInitials(m.firstName,m.lastName)}</div>
              <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{m.firstName} {m.lastName}</p><p className="text-xs text-muted-foreground truncate">{m.email}</p></div>
              <button onClick={()=>assign(m)} disabled={assigning===m.id} className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg gradient-brand text-white hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5">{assigning===m.id?<div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<UserPlus className="w-3 h-3"/>}Assign</button>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-border/50"><button onClick={onClose} className="w-full py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium">Cancel</button></div>
      </div>
    </div>
  );
}

function TrainersTab() {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [viewT, setViewT] = useState<any>(null);
  const [assignT, setAssignT] = useState<any>(null);
  const [editT, setEditT] = useState<any>(null);
  const [removeT, setRemoveT] = useState<any>(null);
  const [removing, setRemoving] = useState(false);

  const fetch = () => { setLoading(true); trainersApi.getAll({limit:100}).then((res: any)=>setTrainers(res.data??[])).catch(()=>{}).finally(()=>setLoading(false)); };
  useEffect(() => { fetch(); }, []);

  const handleRemove = async () => {
    if (!removeT) return; setRemoving(true);
    try { await trainersApi.remove(removeT.id); toast.success(`${removeT.user?.firstName} removed`); setRemoveT(null); fetch(); }
    catch (e: any) { toast.error(e.response?.data?.message??'Failed'); }
    setRemoving(false);
  };

  const statCards = [
    { title:'Total Trainers', value:trainers.length, icon:Dumbbell, gradient:'orange' as const },
    { title:'Available', value:trainers.filter(t=>t.isAvailable).length, icon:CheckCircle, gradient:'green' as const },
    { title:'Avg Rating', value:trainers.length?(trainers.reduce((a,t)=>a+(t.rating??0),0)/trainers.length).toFixed(1):'—', icon:Star, gradient:'purple' as const },
    { title:'Total Clients', value:trainers.reduce((a,t)=>a+(t._count?.memberAssignments??0),0), icon:TrendingUp, gradient:'blue' as const },
  ];

  return (
    <div className="space-y-5">
      {showAdd&&<AddTrainerModal onClose={()=>setShowAdd(false)} onSuccess={fetch}/>}
      {assignT&&<AssignMemberModal trainer={assignT} onClose={()=>setAssignT(null)} onSuccess={fetch}/>}
      {removeT&&<RemoveConfirm title="Remove Trainer?" name={`${removeT.user?.firstName} ${removeT.user?.lastName}`} removing={removing} onClose={()=>setRemoveT(null)} onConfirm={handleRemove}/>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{statCards.map(s=><StatsCard key={s.title} {...s}/>)}</div>

      <div className="flex justify-end"><button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-purple text-white font-bold text-sm hover:opacity-90 transition-all"><Plus className="w-4 h-4"/>Add Trainer</button></div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{Array.from({length:6}).map((_,i)=><div key={i} className="h-64 shimmer-bg rounded-2xl"/>)}</div>
      ) : trainers.length===0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center text-muted-foreground"><Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-20"/><p className="font-semibold">No trainers yet</p><button onClick={()=>setShowAdd(true)} className="mt-4 px-5 py-2.5 rounded-xl gradient-brand text-white font-bold text-sm hover:opacity-90">Add First Trainer</button></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {trainers.map((t: any, i: number) => {
            const grad = GRADS[i%GRADS.length]; const rating = t.rating??0;
            return (
              <div key={t.id} className="group relative bg-card border border-border/60 rounded-2xl overflow-hidden hover:shadow-lifted hover:-translate-y-1 transition-all duration-300">
                <div className={`${grad} p-6 relative overflow-hidden`}>
                  <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10"/>
                  <div className="relative z-10 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl overflow-hidden flex items-center justify-center text-white font-extrabold text-xl border border-white/30">{t.user?.avatar?<img src={t.user.avatar} alt="av" className="w-full h-full object-cover"/>:getInitials(t.user?.firstName,t.user?.lastName)}</div>
                      <div><p className="text-white font-bold text-lg">{t.user?.firstName} {t.user?.lastName}</p><p className="text-white/90 text-xs font-mono font-bold">{t.employeeId?`#${t.employeeId}`:`#TR-${t.id?.slice(0,6).toUpperCase()}`}</p><p className="text-white/70 text-xs">{t.experience??0} yrs · {t.user?.email}</p></div>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm ${t.isAvailable?'bg-white/20 text-white border border-white/30':'bg-black/20 text-white/60 border border-white/10'}`}>{t.isAvailable?'● Available':'● Busy'}</span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3"><div className="flex gap-0.5">{Array.from({length:5}).map((_,j)=><Star key={j} className={`w-4 h-4 ${j<Math.round(rating)?'fill-amber-400 text-amber-400':'text-muted-foreground/20'}`}/>)}</div><span className="text-sm font-bold">{rating.toFixed(1)}</span></div>
                  {t.specializations?.length>0&&<div className="flex flex-wrap gap-1.5 mb-3">{t.specializations.slice(0,3).map((s: string)=><span key={s} className="text-xs font-medium px-2.5 py-1 bg-muted rounded-lg">{s}</span>)}{t.specializations.length>3&&<span className="text-xs px-2.5 py-1 bg-muted/50 rounded-lg text-muted-foreground">+{t.specializations.length-3}</span>}</div>}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[{l:'Clients',v:t._count?.memberAssignments??0,I:Users},{l:'Rate/hr',v:t.hourlyRate?`₹${t.hourlyRate}`:'—',I:TrendingUp}].map(({l,v,I})=>(
                      <div key={l} className="bg-muted/50 rounded-xl p-2.5 text-center"><I className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-1"/><p className="font-extrabold text-sm">{v}</p><p className="text-[10px] text-muted-foreground">{l}</p></div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>setAssignT(t)} className={`flex-1 py-2 text-xs font-bold rounded-xl text-white ${grad} hover:opacity-90`}>Assign</button>
                    <button onClick={()=>setRemoveT(t)} className="w-8 py-2 text-xs rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-500 hover:bg-rose-100 flex items-center justify-center border border-rose-200 dark:border-rose-800/50"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STAFF
═══════════════════════════════════════════════════════════ */
function AddStaffModal({ onClose, onSuccess }: any) {
  const [step, setStep] = useState<1|2>(1);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [avatar, setAvatar] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', phone:'', password:'', designation:'', department:'', salary:'' });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]:v }));

  const sendOtp = async () => {
    if (!form.firstName||!form.email||!form.password) { toast.error('First name, email and password required'); return; }
    if (form.password.length<8) { toast.error('Password must be ≥8 chars'); return; }
    setOtpSending(true);
    try { await authApi.sendOtp(form.email, form.firstName); setStep(2); }
    catch (e: any) { toast.error(e.response?.data?.message??'Failed'); }
    setOtpSending(false);
  };
  const create = async () => {
    setSaving(true);
    try {
      await usersApi.create({ ...form, role:'STAFF', avatar:avatar||null, designation:form.designation||null, department:form.department||null, salary:form.salary?parseFloat(form.salary):null });
      toast.success(`${form.firstName} added!`); onSuccess(); onClose();
    } catch (e: any) { toast.error(e.response?.data?.message??'Failed'); setStep(1); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-pop">
        <div className={`${step===1?'gradient-teal':'gradient-green'} p-5 relative overflow-hidden transition-all duration-700`}>
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none"/>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              {step>1&&<button onClick={()=>setStep(1)} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><ArrowLeft className="w-4 h-4"/></button>}
              <div><h2 className="font-extrabold text-xl text-white">Add Staff</h2><p className="text-sm text-white/70">{step===1?'Staff details':'Verify email'}</p></div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><X className="w-4 h-4"/></button>
          </div>
          <div className="flex items-center gap-2 mt-4">
            {[1,2].map(s=>(
              <div key={s} className="flex items-center gap-2">
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',step>s?'bg-white text-emerald-600':step===s?'bg-white text-gray-900':'bg-white/20 text-white/60')}>{step>s?<CheckCircle className="w-4 h-4"/>:s}</div>
                {s<2&&<div className={cn('h-0.5 w-8 rounded-full transition-all',step>s?'bg-white':'bg-white/25')}/>}
              </div>
            ))}
          </div>
        </div>
        <div className="p-6 space-y-4 max-h-[58vh] overflow-y-auto scrollbar-hide">
          {step===1&&(
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-4 p-3 bg-muted/40 rounded-2xl border border-border/50">
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-muted border-2 border-border shrink-0 flex items-center justify-center">{avatar?<img src={avatar} alt="prev" className="w-full h-full object-cover"/>:<Camera className="w-6 h-6 opacity-40"/>}</div>
                <div className="flex-1"><p className="text-xs font-bold mb-1">Photo <span className="text-muted-foreground font-normal">(optional)</span></p><button type="button" onClick={()=>fileRef.current?.click()} className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-lg"><Upload className="w-3 h-3"/>Upload</button></div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>setAvatar(ev.target?.result as string);r.readAsDataURL(f);}}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[{k:'firstName',l:'First Name *',p:'John'},{k:'lastName',l:'Last Name',p:'Doe'}].map(({k,l,p})=>(
                  <div key={k} className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{l}</label><input value={(form as any)[k]} onChange={e=>set(k,e.target.value)} placeholder={p} className={inp}/></div>
                ))}
              </div>
              <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Email *</label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"/><input type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="staff@gym.com" className={inp+' pl-9'}/></div></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Phone</label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"/><input type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+91 9876543210" className={inp+' pl-9'}/></div></div>
                <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Password *</label><div className="relative"><input type={showPass?'text':'password'} value={form.password} onChange={e=>set('password',e.target.value)} placeholder="Min 8" className={inp+' pr-9'}/><button type="button" onClick={()=>setShowPass(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPass?<EyeOff className="w-3.5 h-3.5"/>:<Eye className="w-3.5 h-3.5"/>}</button></div></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Designation</label><input value={form.designation} onChange={e=>set('designation',e.target.value)} placeholder="Front Desk Officer" className={inp}/></div>
                <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Salary (₹/mo)</label><input type="number" min="0" value={form.salary} onChange={e=>set('salary',e.target.value)} placeholder="25000" className={inp}/></div>
              </div>
              <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Department</label><div className="flex flex-wrap gap-2">{DEPTS.map(d=><button key={d} type="button" onClick={()=>set('department',form.department===d?'':d)} className={cn('px-3 py-1.5 rounded-xl text-xs font-bold transition-all border',form.department===d?'gradient-teal text-white border-transparent':'bg-muted text-muted-foreground border-border hover:bg-muted/80')}>{d}</button>)}</div></div>
            </div>
          )}
          {step===2&&<OtpPanel email={form.email} accent="teal" onVerified={create} onBack={()=>setStep(1)}/>}
        </div>
        <div className="flex items-center justify-between p-5 border-t border-border">
          <button onClick={step===1?onClose:()=>setStep(1)} className="px-5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium flex items-center gap-2">{step>1&&<ArrowLeft className="w-4 h-4"/>}{step===1?'Cancel':'Back'}</button>
          {step===1&&<button onClick={sendOtp} disabled={otpSending} className="px-6 py-2.5 rounded-xl gradient-teal text-white font-bold text-sm disabled:opacity-60 flex items-center gap-2">{otpSending?<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<Send className="w-4 h-4"/>}Send OTP</button>}
          {step===2&&saving&&<div className="px-6 py-2.5 rounded-xl gradient-green text-white font-bold text-sm flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Creating…</div>}
        </div>
      </div>
    </div>
  );
}

function StaffTab() {
  const [staffs, setStaffs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editS, setEditS] = useState<any>(null);
  const [removeS, setRemoveS] = useState<any>(null);
  const [removing, setRemoving] = useState(false);

  const fetch = () => { setLoading(true); staffsApi.getAll({limit:100}).then((res: any)=>setStaffs(res.data??[])).catch(()=>{}).finally(()=>setLoading(false)); };
  useEffect(() => { fetch(); }, []);

  const handleRemove = async () => {
    if (!removeS) return; setRemoving(true);
    try { await staffsApi.remove(removeS.id); toast.success(`${removeS.user?.firstName} removed`); setRemoveS(null); fetch(); }
    catch (e: any) { toast.error(e.response?.data?.message??'Failed'); }
    setRemoving(false);
  };

  const statCards = [
    { title:'Total Staff', value:staffs.length, icon:UserCheck, gradient:'orange' as const },
    { title:'Active', value:staffs.filter((s: any)=>s.user?.isActive).length, icon:CheckCircle, gradient:'green' as const },
    { title:'Departments', value:new Set(staffs.map((s: any)=>s.department).filter(Boolean)).size, icon:Briefcase, gradient:'purple' as const },
    { title:'New This Month', value:staffs.filter((s: any)=>new Date(s.createdAt)>new Date(Date.now()-30*86400000)).length, icon:Users, gradient:'blue' as const },
  ];

  return (
    <div className="space-y-5">
      {showAdd&&<AddStaffModal onClose={()=>setShowAdd(false)} onSuccess={fetch}/>}
      {removeS&&<RemoveConfirm title="Remove Staff?" name={`${removeS.user?.firstName} ${removeS.user?.lastName}`} removing={removing} onClose={()=>setRemoveS(null)} onConfirm={handleRemove}/>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{statCards.map(s=><StatsCard key={s.title} {...s}/>)}</div>

      <div className="flex justify-end"><button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-teal text-white font-bold text-sm hover:opacity-90 transition-all"><Plus className="w-4 h-4"/>Add Staff</button></div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{Array.from({length:6}).map((_,i)=><div key={i} className="h-48 shimmer-bg rounded-2xl"/>)}</div>
      ) : staffs.length===0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center text-muted-foreground"><UserCheck className="w-12 h-12 mx-auto mb-3 opacity-20"/><p className="font-semibold">No staff yet</p><button onClick={()=>setShowAdd(true)} className="mt-4 px-5 py-2.5 rounded-xl gradient-brand text-white font-bold text-sm hover:opacity-90">Add First Staff</button></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {staffs.map((s: any) => (
            <div key={s.id} className="group bg-card border border-border/60 rounded-2xl overflow-hidden hover:shadow-lifted hover:-translate-y-1 transition-all duration-300">
              <div className="gradient-teal p-5 relative overflow-hidden">
                <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full bg-white/10"/>
                <div className="relative z-10 flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl overflow-hidden flex items-center justify-center text-white font-extrabold text-lg border border-white/30">{s.user?.avatar?<img src={s.user.avatar} alt="av" className="w-full h-full object-cover"/>:getInitials(s.user?.firstName,s.user?.lastName)}</div>
                  <div className="flex-1"><p className="text-white font-bold">{s.user?.firstName} {s.user?.lastName}</p><p className="text-white/90 text-xs font-mono font-bold">{s.employeeId?`#${s.employeeId}`:`#ST-${s.id?.slice(0,6).toUpperCase()}`}</p><p className="text-white/70 text-xs">{s.designation||'Staff Member'}</p></div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.user?.isActive?'bg-white/20 text-white border border-white/30':'bg-black/20 text-white/60 border border-white/10'}`}>{s.user?.isActive?'● Active':'● Inactive'}</span>
                </div>
              </div>
              <div className="p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="w-3.5 h-3.5 shrink-0"/><span className="truncate">{s.user?.email}</span></div>
                {s.user?.phone&&<div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="w-3.5 h-3.5 shrink-0"/>{s.user.phone}</div>}
                <div className="flex items-center justify-between">
                  {s.department?<span className={cn('text-xs font-bold px-2.5 py-1 rounded-xl',DEPT_CL[s.department]??'bg-muted text-muted-foreground')}>{s.department}</span>:<span className="text-xs text-muted-foreground">No department</span>}
                  {s.salary&&<span className="text-xs font-bold text-muted-foreground">₹{Number(s.salary).toLocaleString()}/mo</span>}
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={()=>setEditS(s)} className="flex-1 py-2 text-xs font-bold rounded-xl gradient-teal text-white hover:opacity-90">Edit</button>
                  <button onClick={()=>setRemoveS(s)} className="w-8 py-2 text-xs rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-500 hover:bg-rose-100 flex items-center justify-center border border-rose-200 dark:border-rose-800/50"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline Edit Staff Modal */}
      {editS&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={()=>setEditS(null)}>
          <div className="bg-card border border-border/80 rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-pop" onClick={e=>e.stopPropagation()}>
            <EditStaffInline staff={editS} onClose={()=>setEditS(null)} onSuccess={()=>{fetch();setEditS(null);}}/>
          </div>
        </div>
      )}
    </div>
  );
}

function EditStaffInline({ staff, onClose, onSuccess }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName:staff.user?.firstName??'', lastName:staff.user?.lastName??'', phone:staff.user?.phone??'', designation:staff.designation??'', department:staff.department??'', salary:staff.salary?String(staff.salary):'' });
  const fieldInp = 'w-full bg-background border-2 border-border rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all placeholder:text-muted-foreground/40';
  const save = async () => {
    if (!form.firstName.trim()) { toast.error('First name required'); return; }
    setSaving(true);
    try {
      await Promise.all([usersApi.update(staff.user.id,{firstName:form.firstName,lastName:form.lastName,phone:form.phone||undefined}),staffsApi.update(staff.id,{designation:form.designation||null,department:form.department||null,salary:form.salary?Number(form.salary):null})]);
      toast.success('Staff updated!'); onSuccess();
    } catch {} finally { setSaving(false); }
  };
  return (
    <>
      <div className="relative overflow-hidden gradient-teal px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3"><div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white/40 bg-white/20 flex items-center justify-center text-white font-extrabold text-lg">{getInitials(form.firstName,form.lastName)}</div><div><h2 className="font-extrabold text-lg text-white">Edit Staff</h2><p className="text-white/70 text-xs">{staff.user?.firstName} {staff.user?.lastName}</p></div></div>
        <button onClick={onClose} className="w-9 h-9 rounded-2xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white"><X className="w-4 h-4"/></button>
      </div>
      <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">First Name *</label><input value={form.firstName} onChange={e=>setForm(f=>({...f,firstName:e.target.value}))} className={fieldInp} placeholder="First name"/></div>
          <div className="space-y-1.5"><label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Last Name</label><input value={form.lastName} onChange={e=>setForm(f=>({...f,lastName:e.target.value}))} className={fieldInp} placeholder="Last name"/></div>
          <div className="col-span-2 space-y-1.5"><label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Phone</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className={fieldInp} placeholder="+91 9876543210"/></div>
        </div>
        <div className="space-y-1.5"><label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Designation</label><input value={form.designation} onChange={e=>setForm(f=>({...f,designation:e.target.value}))} className={fieldInp} placeholder="e.g. Front Desk"/></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Department</label><select value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))} className={fieldInp+' appearance-none cursor-pointer'}><option value="">Select</option>{DEPTS.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
          <div className="space-y-1.5"><label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Salary (₹/mo)</label><input type="number" value={form.salary} onChange={e=>setForm(f=>({...f,salary:e.target.value}))} className={fieldInp} placeholder="25000"/></div>
        </div>
      </div>
      <div className="flex gap-3 px-5 py-4 border-t border-border">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-2xl border-2 border-border hover:bg-muted text-sm font-bold">Cancel</button>
        <button onClick={save} disabled={saving} className="flex-[2] py-2.5 rounded-2xl gradient-teal text-white font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-60">{saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}{saving?'Saving…':'Save Changes'}</button>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   PLANS TAB
═══════════════════════════════════════════════════════════ */
const PLAN_TYPES = ['MONTHLY','QUARTERLY','HALF_YEARLY','YEARLY','CUSTOM'] as const;
const TYPE_COLORS: Record<string,string> = {
  MONTHLY:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  QUARTERLY:'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  HALF_YEARLY:'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  YEARLY:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  CUSTOM:'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

function PlanFormModal({ plan, onClose, onSuccess }: any) {
  const isEdit = !!plan;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: plan?.name ?? '',
    type: plan?.type ?? 'MONTHLY',
    price: plan?.price ?? 0,
    discount: plan?.discount ?? 0,
    durationMonths: plan?.durationMonths ?? 1,
    features: plan?.features?.join(', ') ?? '',
    isActive: plan?.isActive ?? true,
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    if (form.price < 0) { toast.error('Price must be ≥ 0'); return; }
    setSaving(true);
    try {
      const data = { ...form, price: +form.price, discount: +form.discount, durationMonths: +form.durationMonths, features: form.features.split(',').map((s:string)=>s.trim()).filter(Boolean) };
      if (isEdit) await membershipPlansApi.update(plan.id, data);
      else await membershipPlansApi.create(data);
      toast.success(isEdit ? 'Plan updated' : 'Plan created');
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-pop">
        <div className={`${isEdit ? 'gradient-teal' : 'gradient-brand'} p-5 relative overflow-hidden`}>
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none"/>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center"><CreditCard className="w-5 h-5 text-white"/></div>
              <div><h2 className="font-extrabold text-xl text-white">{isEdit ? 'Edit Plan' : 'New Plan'}</h2><p className="text-sm text-white/70">{isEdit ? `Editing ${plan.name}` : 'Create a membership plan'}</p></div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><X className="w-4 h-4"/></button>
          </div>
        </div>
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-hide">
          <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Plan Name *</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Standard Monthly" className={inp}/></div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Type</label>
            <select value={form.type} onChange={e=>{set('type',e.target.value);const dm={MONTHLY:1,QUARTERLY:3,HALF_YEARLY:6,YEARLY:12,CUSTOM:1};set('durationMonths',(dm as any)[e.target.value]??1);}} className={inp+' appearance-none cursor-pointer'}>
              {PLAN_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Price (₹)</label><input type="number" min="0" value={form.price} onChange={e=>set('price',e.target.value)} className={inp}/></div>
            <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Discount (%)</label><input type="number" min="0" max="100" value={form.discount} onChange={e=>set('discount',e.target.value)} className={inp}/></div>
            <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Duration (mo)</label><input type="number" min="1" value={form.durationMonths} onChange={e=>set('durationMonths',e.target.value)} className={inp}/></div>
          </div>
          <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Features (comma-separated)</label><input value={form.features} onChange={e=>set('features',e.target.value)} placeholder="e.g. Unlimited Access, Locker, Pool" className={inp}/></div>
          <div className="flex items-center justify-between p-3.5 bg-muted/40 rounded-2xl border border-border/60">
            <div><p className="text-sm font-bold">Active</p><p className="text-xs text-muted-foreground">Members can see and buy this plan</p></div>
            <button onClick={()=>set('isActive',!form.isActive)} className={cn('relative w-11 h-6 rounded-full transition-colors',form.isActive?'gradient-brand':'bg-muted-foreground/30')}>
              <span className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',form.isActive?'translate-x-5':'translate-x-0.5')}/>
            </button>
          </div>
          {form.discount > 0 && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 rounded-xl">
              <p className="text-xs font-bold text-emerald-700">Effective price: ₹{Math.round(+form.price * (1 - +form.discount/100)).toLocaleString()}</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium">Cancel</button>
          <button onClick={save} disabled={saving} className={cn('flex-[2] py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60',isEdit?'gradient-teal':'gradient-brand')}>
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Save className="w-4 h-4"/>}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlansTab() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editPlan, setEditPlan] = useState<any>(null);
  const [deletePlan, setDeletePlan] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const fetch = () => {
    setLoading(true);
    membershipPlansApi.getAll().then((r:any)=>setPlans(r.data??r??[])).catch(()=>{}).finally(()=>setLoading(false));
  };
  useEffect(() => { fetch(); }, []);

  const handleDelete = async () => {
    if (!deletePlan) return;
    setDeleting(true);
    try { await membershipPlansApi.remove(deletePlan.id); toast.success(`${deletePlan.name} deleted`); setDeletePlan(null); fetch(); }
    catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed'); }
    setDeleting(false);
  };

  const toggleActive = async (plan: any) => {
    try { await membershipPlansApi.update(plan.id, { isActive: !plan.isActive }); fetch(); }
    catch { toast.error('Failed to update'); }
  };

  const active = plans.filter(p=>p.isActive);
  const prices = plans.map(p=>p.price).filter(Boolean);
  const statCards = [
    { title:'Total Plans', value:plans.length, icon:CreditCard, gradient:'blue' as const },
    { title:'Active Plans', value:active.length, icon:CheckCircle, gradient:'green' as const },
    { title:'Lowest Price', value:prices.length?`₹${Math.min(...prices).toLocaleString()}`:'—', icon:Tag, gradient:'orange' as const },
    { title:'Highest Price', value:prices.length?`₹${Math.max(...prices).toLocaleString()}`:'—', icon:TrendingUp, gradient:'purple' as const },
  ];

  return (
    <div className="space-y-5">
      {showAdd && <PlanFormModal onClose={()=>setShowAdd(false)} onSuccess={fetch}/>}
      {editPlan && <PlanFormModal plan={editPlan} onClose={()=>setEditPlan(null)} onSuccess={fetch}/>}
      {deletePlan && <RemoveConfirm title="Delete Plan?" name={deletePlan.name} removing={deleting} onClose={()=>setDeletePlan(null)} onConfirm={handleDelete}/>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{statCards.map(s=><StatsCard key={s.title} {...s}/>)}</div>

      <div className="flex justify-end">
        <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-brand text-white font-bold text-sm hover:opacity-90 transition-all"><Plus className="w-4 h-4"/>Add Plan</button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{Array.from({length:4}).map((_,i)=><div key={i} className="h-56 shimmer-bg rounded-2xl"/>)}</div>
      ) : plans.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center text-muted-foreground">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-20"/>
          <p className="font-semibold">No membership plans yet</p>
          <p className="text-sm mt-1">Create plans to control pricing for your members</p>
          <button onClick={()=>setShowAdd(true)} className="mt-4 px-5 py-2.5 rounded-xl gradient-brand text-white font-bold text-sm hover:opacity-90">Create First Plan</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {plans.map((plan: any) => (
            <div key={plan.id} className={cn('group bg-card border rounded-2xl overflow-hidden hover:shadow-lifted hover:-translate-y-1 transition-all duration-300',plan.isActive?'border-border/60':'border-border/30 opacity-60')}>
              <div className="gradient-brand p-5 relative overflow-hidden">
                <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10 pointer-events-none"/>
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white font-extrabold text-lg">{plan.name}</p>
                    <span className={cn('inline-block text-xs font-bold px-2.5 py-1 rounded-full mt-1 bg-white/20 text-white border border-white/30')}>{plan.type.replace(/_/g,' ')}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-extrabold text-2xl">₹{plan.price.toLocaleString()}</p>
                    {plan.discount > 0 && <p className="text-white/70 text-xs">{plan.discount}% off</p>}
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-bold">{plan.durationMonths} month{plan.durationMonths !== 1 ? 's' : ''}</span>
                </div>
                {plan.features?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {plan.features.slice(0,4).map((f:string)=><span key={f} className="text-xs px-2.5 py-1 bg-muted rounded-lg">{f}</span>)}
                    {plan.features.length > 4 && <span className="text-xs px-2.5 py-1 bg-muted/50 rounded-lg text-muted-foreground">+{plan.features.length-4}</span>}
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <button onClick={()=>toggleActive(plan)} className={cn('flex items-center gap-1.5 text-xs font-bold transition-colors',plan.isActive?'text-emerald-600 hover:text-emerald-700':'text-muted-foreground hover:text-foreground')}>
                    {plan.isActive ? <ToggleRight className="w-4 h-4"/> : <ToggleLeft className="w-4 h-4"/>}
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={()=>setEditPlan(plan)} className="px-3 py-1.5 text-xs font-bold rounded-xl gradient-teal text-white hover:opacity-90">Edit</button>
                    <button onClick={()=>setDeletePlan(plan)} className="w-8 py-1.5 text-xs rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-500 hover:bg-rose-100 flex items-center justify-center border border-rose-200 dark:border-rose-800/50"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE — animated tab switcher
═══════════════════════════════════════════════════════════ */
const TABS = [
  { key:'members', label:'Members', icon:Users,      accent:'from-blue-500 to-indigo-600',   pill:'bg-blue-500' },
  { key:'trainers',label:'Trainers',icon:Dumbbell,   accent:'from-purple-500 to-violet-600', pill:'bg-purple-500' },
  { key:'staff',   label:'Staff',   icon:UserCheck,  accent:'from-teal-500 to-emerald-600',  pill:'bg-teal-500' },
  { key:'plans',   label:'Plans',   icon:CreditCard, accent:'from-emerald-500 to-green-600', pill:'bg-emerald-500' },
] as const;
type Tab = typeof TABS[number]['key'];

function PeoplePageInner() {
  const searchParams = useSearchParams();
  const initialTab = (['members','trainers','staff','plans'] as Tab[]).includes(searchParams.get('tab') as Tab)
    ? (searchParams.get('tab') as Tab)
    : 'members';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [prevTab, setPrevTab] = useState<Tab>('members');
  const [animating, setAnimating] = useState(false);

  const switchTab = (t: Tab) => {
    if (t === tab || animating) return;
    setPrevTab(tab);
    setAnimating(true);
    setTab(t);
    setTimeout(() => setAnimating(false), 320);
  };

  const current = TABS.find(t => t.key === tab)!;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">People</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Manage your members, trainers and staff in one place</p>
        </div>
      </div>

      {/* Animated Tab Bar */}
      <div className="relative flex items-center gap-1 p-1.5 bg-muted/60 backdrop-blur rounded-2xl border border-border/40 w-fit">
        {/* Sliding background pill */}
        <div
          className={`absolute inset-y-1.5 rounded-xl transition-all duration-300 ease-out bg-gradient-to-r ${current.accent} shadow-lg tab-pill`}
          style={{ '--pill-left': `${TABS.findIndex(t=>t.key===tab) * (100/4)}%` } as React.CSSProperties}
        />
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={cn(
                'relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200',
                active ? 'text-white' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content with slide animation */}
      <div
        key={tab}
        className={cn('transition-all duration-300', animating ? 'opacity-0 translate-y-2 no-animation' : 'opacity-100 translate-y-0')}
      >
        {tab === 'members'  && <MembersTab />}
        {tab === 'trainers' && <TrainersTab />}
        {tab === 'staff'    && <StaffTab />}
        {tab === 'plans'    && <PlansTab />}
      </div>
    </div>
  );
}

export default function PeoplePage() {
  return (
    <Suspense fallback={null}>
      <PeoplePageInner />
    </Suspense>
  );
}
