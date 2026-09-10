'use client';

import { ClassesManager } from '@/features/classes/classes-manager';
import { useAuthStore } from '@/store/auth.store';

export default function InstructorClassesPage() {
  const user = useAuthStore((state) => state.user);
  const lockedInstructor = user
    ? { id: user.id, firstName: user.firstName, lastName: user.lastName }
    : null;

  return <ClassesManager badge="Instructor" lockedInstructor={lockedInstructor} />;
}