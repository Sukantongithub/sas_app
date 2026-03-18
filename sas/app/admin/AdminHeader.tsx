import React from 'react';
import CommonHeader from '@/components/CommonHeader';

interface AdminHeaderProps {
  title?: string;
}

export default function AdminHeader({ title }: AdminHeaderProps) {
  return <CommonHeader title={title || 'Admin'} showNotifications />;
}
