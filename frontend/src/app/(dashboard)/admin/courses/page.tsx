'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpen, Hash, FolderOpen } from 'lucide-react';
import { coursesService } from '@/services/courses.service';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminCoursesPage() {
  const { data: courses, isLoading, error } = useQuery({
    queryKey: ['admin', 'courses'],
    queryFn: () => coursesService.list(),
  });

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline">Admin</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Courses</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Manage courses linked to subjects and departments.
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        {courses && <span>{courses.length} total</span>}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-40 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Failed to load courses</CardTitle>
            <CardDescription>{(error as Error).message}</CardDescription>
          </CardHeader>
        </Card>
      ) : !courses || courses.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No courses found</CardTitle>
            <CardDescription>No courses have been created yet.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium"><Hash className="mr-1 inline h-3 w-3" />Code</th>
                  <th className="p-3 text-left font-medium"><BookOpen className="mr-1 inline h-3 w-3" />Name</th>
                  <th className="p-3 text-left font-medium"><FolderOpen className="mr-1 inline h-3 w-3" />Subject</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id} className="border-b transition-colors hover:bg-muted/50 last:border-0">
                    <td className="p-3 font-mono text-xs font-medium">{course.code}</td>
                    <td className="p-3">{course.name}</td>
                    <td className="p-3 text-muted-foreground">
                      {course.subject?.name || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
