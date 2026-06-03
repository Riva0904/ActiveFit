import { redirect } from 'next/navigation';

export default function StaffsPage() {
  redirect('/admin/members?tab=staff');
}
