'use client';

import { useEffect, useState } from 'react';
import { referralsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Gift, Copy, Share2, Users, IndianRupee, CheckCircle, Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReferralsPage() {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    referralsApi.getMyInfo().then((data: any) => {
      setInfo(data);
    }).catch(() => { }).finally(() => setLoading(false));
  }, []);

  const referralLink = info?.referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${info.referralCode}`
    : '';

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (!referralLink) return;
    if (navigator.share) {
      navigator.share({ title: 'Join my gym!', url: referralLink });
    } else {
      copyLink();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  const paidReferrals = info?.referrals?.filter((r: any) => r.hasActiveMembership) ?? [];
  const pendingReferrals = info?.referrals?.filter((r: any) => !r.hasActiveMembership) ?? [];

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto mb-4">
          <Gift className="w-8 h-8 text-brand" />
        </div>
        <h1 className="text-2xl font-bold">Refer & Earn</h1>
        <p className="text-muted-foreground text-sm mt-2">Invite friends to join the gym and earn ₹500 credit for each successful referral</p>
      </div>

      {/* Credit Balance */}
      <div className="bg-gradient-to-br from-brand/10 to-purple-500/10 border border-brand/20 rounded-2xl p-6 text-center">
        <p className="text-sm text-muted-foreground font-medium">Your Referral Credit</p>
        <div className="flex items-center justify-center gap-1 mt-2">
          <IndianRupee className="w-7 h-7 text-brand font-bold" />
          <span className="text-4xl font-black text-brand">{(info?.referralCredit ?? 0).toFixed(0)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Apply this credit at your next membership renewal</p>
      </div>

      {/* Referral Link */}
      {info?.referralCode ? (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <Share2 className="w-4 h-4 text-brand" /> Your Referral Link
          </h2>
          <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-xl p-3">
            <p className="text-sm text-muted-foreground flex-1 truncate font-mono text-xs">{referralLink}</p>
            <button
              onClick={copyLink}
              className={cn(
                'flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex-shrink-0',
                copied ? 'bg-green-100 text-green-700' : 'bg-brand text-white hover:opacity-90'
              )}
            >
              {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={copyLink}
              className="flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <Copy className="w-4 h-4" /> Copy Link
            </button>
            <button
              onClick={shareLink}
              className="flex items-center justify-center gap-2 gradient-brand text-white rounded-xl py-2.5 text-sm font-bold hover:opacity-90 transition-all"
            >
              <Share2 className="w-4 h-4" /> Share Now
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-5 text-center text-muted-foreground text-sm">
          Your referral code will appear here once your membership is activated.
        </div>
      )}

      {/* How It Works */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-bold text-sm mb-4">How It Works</h2>
        <div className="space-y-4">
          {[
            { step: '1', icon: Share2, title: 'Share your link', desc: 'Send your unique referral link to friends and family' },
            { step: '2', icon: Users, title: 'Friend joins & pays', desc: 'They sign up and activate a paid membership at your gym' },
            { step: '3', icon: IndianRupee, title: 'You earn ₹500', desc: 'Credit is automatically added to your account' },
          ].map(({ step, icon: Icon, title, desc }) => (
            <div key={step} className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-brand" />
              </div>
              <div>
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Referral History */}
      {(info?.referrals?.length ?? 0) > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand" /> Friends You Referred ({info.referrals.length})
          </h2>
          <div className="space-y-3">
            {info.referrals.map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold">
                  {r.name?.charAt(0) ?? '?'}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Joined {new Date(r.joinedAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <span className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full',
                  r.hasActiveMembership ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                )}>
                  {r.hasActiveMembership ? '₹500 Earned' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
