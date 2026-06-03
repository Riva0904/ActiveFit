'use client';

import { useState } from 'react';
import { User, Save, Camera, Phone, MapPin, Calendar } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { usersApi } from '@/lib/api';
import { getInitials } from '@/lib/utils';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
    dateOfBirth: '',
    gender: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    emergencyContact: '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const updated: any = await usersApi.updateMe(form);
      updateUser(updated);
      toast.success('Profile updated successfully!');
    } catch { }
    setSaving(false);
  };

  return (
    <div className="max-w-3xl space-y-6 animate-slide-up">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center shadow-brand">
          <User className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">My Profile</h1>
          <p className="text-sm text-muted-foreground">Update your personal information</p>
        </div>
      </div>

      {/* Profile hero */}
      <div className="relative overflow-hidden rounded-2xl gradient-brand p-8 shadow-brand animate-slide-up" style={{ animationDelay: '80ms' }}>
        <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/10 animate-card-float" />
        <div className="absolute bottom-0 left-24 w-40 h-40 rounded-full bg-black/15 blur-2xl" />
        <div className="absolute top-4 left-1/2 w-24 h-24 rounded-full bg-white/5" />

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="relative">
              <div className="w-[88px] h-[88px] bg-white/20 backdrop-blur-sm rounded-2xl border-4 border-white/40 flex items-center justify-center text-white font-extrabold text-3xl shadow-inner">
                {getInitials(user?.firstName ?? '', user?.lastName ?? '')}
              </div>
              <button className="absolute -bottom-1.5 -right-1.5 w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-lg hover:bg-orange-50 active:scale-95 transition-all">
                <Camera className="w-3.5 h-3.5 text-orange-600" />
              </button>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">{user?.firstName} {user?.lastName}</h2>
              <p className="text-white/70 mt-0.5 text-sm">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <span className="text-xs font-bold bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full border border-white/30 capitalize">
                  {user?.role?.toLowerCase().replace(/_/g, ' ')}
                </span>
                <span className="text-xs font-bold bg-emerald-500/30 text-white px-3 py-1 rounded-full border border-emerald-400/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/50 font-medium">Last updated</p>
            <p className="text-sm font-bold text-white/90">Today</p>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="bg-card border border-border/60 rounded-2xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
          <div className="w-9 h-9 gradient-brand rounded-xl flex items-center justify-center text-white">
            <User className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="font-bold">Personal Information</h3>
            <p className="text-xs text-muted-foreground">Update your profile details</p>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'firstName', label: 'First Name', icon: User },
              { key: 'lastName', label: 'Last Name', icon: User },
              { key: 'phone', label: 'Phone Number', type: 'tel', icon: Phone },
              { key: 'dateOfBirth', label: 'Date of Birth', type: 'date', icon: Calendar },
            ].map(({ key, label, type = 'text', icon: Icon }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type={type} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full h-11 pl-10 pr-4 text-sm bg-muted/40 border border-border/60 rounded-xl outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Gender</label>
            <div className="flex gap-3">
              {['Male', 'Female', 'Other'].map(g => (
                <button key={g} onClick={() => setForm(f => ({ ...f, gender: g.toLowerCase() }))}
                  className={cn('flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all', form.gender === g.toLowerCase() ? 'border-primary/40 bg-primary/5 text-primary font-bold' : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted')}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'address', label: 'Address', icon: MapPin },
              { key: 'city', label: 'City', icon: MapPin },
              { key: 'state', label: 'State', icon: MapPin },
              { key: 'pincode', label: 'Pincode', icon: MapPin },
              { key: 'emergencyContact', label: 'Emergency Contact', type: 'tel', icon: Phone },
            ].map(({ key, label, type = 'text', icon: Icon }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type={type} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full h-11 pl-10 pr-4 text-sm bg-muted/40 border border-border/60 rounded-xl outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" />
                </div>
              </div>
            ))}
          </div>

          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl gradient-brand text-white font-bold text-sm shadow-brand hover:opacity-90 transition-all disabled:opacity-70">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
