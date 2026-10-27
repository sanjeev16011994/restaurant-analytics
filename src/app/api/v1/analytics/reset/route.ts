import { NextResponse } from 'next/server';
import { resetAllData } from '@/lib/db';

export async function POST() {
  try {
    resetAllData();
    return NextResponse.json({
      success: true,
      message: 'All analytics events and restaurant orders have been reset.',
    });
  } catch (err) {
    console.error('Failed to reset data:', err);
    return NextResponse.json({ error: 'Failed to reset data' }, { status: 500 });
  }
}
