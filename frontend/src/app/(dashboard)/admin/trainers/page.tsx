import { redirect } from 'next/navigation';

export default function TrainersPage() {
  redirect('/admin/members?tab=trainers');
}
