import { NextResponse } from 'next/server';
import { seedHistoricData } from '@/lib/db';

export async function POST() {
  try {
    seedHistoricData();
    return NextResponse.json({
      success: true,
      message: 'Successfully populated 7 days of realistic restaurant traffic, visitor sessions, and orders.',
    });
  } catch (err) {
    console.error('Failed to seed demo data:', err);
    return NextResponse.json({ error: 'Failed to seed demo data' }, { status: 500 });
  }
}
