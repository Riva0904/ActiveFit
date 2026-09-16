'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { usersApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type NewRole = 'MEMBER' | 'TRAINER';

const ROLES: { value: NewRole; label: string; hint: string }[] = [
  { value: 'MEMBER', label: 'Member', hint: 'Someone joining the gym' },
  { value: 'TRAINER', label: 'Trainer', hint: 'Coach who takes sessions' },
];

/**
 * Front-desk sign-up. Staff can create members and trainers — the same two
 * roles the backend lets them create, so nothing offered here comes back 403.
 */
export default function StaffPeoplePage() {
  const [role, setRole] = useState<NewRole>('MEMBER');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const ready = form.firstName.trim().length > 1 && form.lastName.trim() && emailOk && form.password.length >= 8;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    try {
      await usersApi.create({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        role,
      });
      toast.success(`${form.firstName} can sign in now`);
      setForm({ firstName: '', lastName: '', email: '', phone: '', password: '' });
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not add this person');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-xl">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-white" />
          </span>
          Add a person
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sign up a member or trainer at the desk. They can log in straight away with the password you set.
        </p>
      </div>

      <form onSubmit={submit} className="bg-card border border-border/60 rounded-2xl p-5 space-y-4">
        <div className="flex gap-2">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className={cn(
                'flex-1 rounded-xl border p-3 text-left transition-all',
                role === r.value ? 'border-primary bg-primary/5' : 'border-border/60 hover:bg-muted/40',
              )}
            >
              <p className="font-bold text-sm">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.hint}</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="First name"><input value={form.firstName} onChange={set('firstName')} className={inputCls} placeholder="Ravi" /></Field>
          <Field label="Last name"><input value={form.lastName} onChange={set('lastName')} className={inputCls} placeholder="Kumar" /></Field>
        </div>
        <Field label="Email"><input value={form.email} onChange={set('email')} className={inputCls} placeholder="ravi@example.com" type="email" /></Field>
        <Field label="Phone (optional)"><input value={form.phone} onChange={set('phone')} className={inputCls} placeholder="+91…" /></Field>
        <Field label="Temporary password">
          <input value={form.password} onChange={set('password')} className={inputCls} placeholder="At least 8 characters" type="password" />
        </Field>

        <p className="text-xs text-muted-foreground">
          Share this password with them and ask them to change it after their first sign-in.
        </p>

        <button
          type="submit"
          disabled={!ready || saving}
          className="gradient-brand text-white font-bold text-sm px-5 py-2.5 rounded-xl disabled:opacity-50"
        >
          {saving ? 'Adding…' : `Add ${role === 'MEMBER' ? 'member' : 'trainer'}`}
        </button>
      </form>
    </div>
  );
}

const inputCls =
  'w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 transition-all';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
