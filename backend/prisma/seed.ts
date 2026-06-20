import { PrismaClient, RoleName, UserStatus, QuestionType, Difficulty, ExamStatus, SessionStatus, SubmissionStatus, NotificationType, ViolationType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const permissions = [
  ['users.read', 'Read users', 'users'],
  ['users.write', 'Write users', 'users'],
  ['roles.manage', 'Manage roles', 'roles'],
  ['subjects.manage', 'Manage subjects', 'subjects'],
  ['courses.manage', 'Manage courses', 'courses'],
  ['exams.manage', 'Manage exams', 'exams'],
  ['questions.manage', 'Manage questions', 'questions'],
  ['sessions.monitor', 'Monitor exam sessions', 'exam-sessions'],
  ['reports.read', 'Read reports', 'reports'],
  ['audit.read', 'Read audit logs', 'audit-logs'],
] as const;

const rolePermissionsMap: Record<RoleName, string[]> = {
  SUPER_ADMIN: ['users.read', 'users.write', 'roles.manage', 'subjects.manage', 'courses.manage', 'exams.manage', 'questions.manage', 'sessions.monitor', 'reports.read', 'audit.read'],
  ADMIN: ['users.read', 'subjects.manage', 'courses.manage', 'exams.manage', 'questions.manage', 'sessions.monitor', 'reports.read', 'audit.read'],
  INSTRUCTOR: ['exams.manage', 'questions.manage', 'sessions.monitor', 'reports.read'],
  STUDENT: ['users.read'],
};

const subjects = [
  { code: 'CS', name: 'Computer Science', description: 'Study of computation, algorithms, programming, and computer systems.' },
  { code: 'MATH', name: 'Mathematics', description: 'Study of numbers, quantities, geometry, and mathematical structures.' },
  { code: 'PHY', name: 'Physics', description: 'Study of matter, energy, space, time, and their interactions.' },
  { code: 'ENG', name: 'English Literature', description: 'Study of prose, poetry, drama, and literary analysis.' },
  { code: 'BIO', name: 'Biology', description: 'Study of living organisms, genetics, evolution, and ecosystems.' },
];

const courses = [
  { subjectCode: 'CS', code: 'CS101', name: 'Introduction to Programming' },
  { subjectCode: 'CS', code: 'CS201', name: 'Data Structures & Algorithms' },
  { subjectCode: 'CS', code: 'CS301', name: 'Database Systems' },
  { subjectCode: 'MATH', code: 'MATH101', name: 'Calculus I' },
  { subjectCode: 'MATH', code: 'MATH201', name: 'Linear Algebra' },
  { subjectCode: 'PHY', code: 'PHY101', name: 'Classical Mechanics' },
  { subjectCode: 'PHY', code: 'PHY201', name: 'Electromagnetism' },
  { subjectCode: 'ENG', code: 'ENG101', name: 'Introduction to Poetry' },
  { subjectCode: 'ENG', code: 'ENG201', name: 'Shakespearean Drama' },
  { subjectCode: 'BIO', code: 'BIO101', name: 'Cell Biology' },
  { subjectCode: 'BIO', code: 'BIO201', name: 'Genetics & Evolution' },
];

interface QuestionDef {
  type: QuestionType;
  difficulty: Difficulty;
  prompt: string;
  explanation?: string;
  points: number;
  tags: string;
  options: Array<{ label: string; text: string; isCorrect: boolean }>;
}

const questionsByCourse: Record<string, QuestionDef[]> = {
  'CS101': [
    { type: 'MULTIPLE_CHOICE', difficulty: 'EASY', prompt: 'Which of the following is a valid variable name in Python?', explanation: 'Variable names cannot start with a digit or contain special characters beyond underscore.', points: 2, tags: 'python, variables', options: [
      { label: 'A', text: '2nd_value', isCorrect: false },
      { label: 'B', text: '_value2', isCorrect: true },
      { label: 'C', text: 'value-2', isCorrect: false },
      { label: 'D', text: 'value 2', isCorrect: false },
    ]},
    { type: 'MULTIPLE_CHOICE', difficulty: 'EASY', prompt: 'What does the `len()` function return for a string?', explanation: 'len() returns the number of characters in the string.', points: 1, tags: 'python, strings', options: [
      { label: 'A', text: 'Memory size in bytes', isCorrect: false },
      { label: 'B', text: 'Number of characters', isCorrect: true },
      { label: 'C', text: 'Number of words', isCorrect: false },
      { label: 'D', text: 'Hash value', isCorrect: false },
    ]},
    { type: 'TRUE_FALSE', difficulty: 'EASY', prompt: 'In Python, `is` and `==` are interchangeable for comparing integers.', explanation: '`is` compares identity (memory address), while `==` compares value.', points: 1, tags: 'python, operators', options: [
      { label: 'A', text: 'True', isCorrect: false },
      { label: 'B', text: 'False', isCorrect: true },
    ]},
    { type: 'MULTIPLE_SELECT', difficulty: 'MEDIUM', prompt: 'Which of the following are primitive data types in Java? (Select all that apply)', explanation: 'String and Array are reference types in Java.', points: 3, tags: 'java, types', options: [
      { label: 'A', text: 'int', isCorrect: true },
      { label: 'B', text: 'String', isCorrect: false },
      { label: 'C', text: 'boolean', isCorrect: true },
      { label: 'D', text: 'Array', isCorrect: false },
      { label: 'E', text: 'char', isCorrect: true },
    ]},
    { type: 'FILL_BLANK', difficulty: 'MEDIUM', prompt: 'The time complexity of binary search in a sorted array is O(log _).', explanation: 'Binary search halves the search space at each step, giving O(log n).', points: 2, tags: 'algorithms, complexity', options: [
      { label: 'A', text: 'n', isCorrect: false },
      { label: 'B', text: 'log n', isCorrect: true },
    ]},
    { type: 'SHORT_ANSWER', difficulty: 'HARD', prompt: 'Explain the difference between a stack and a queue data structure.', explanation: 'Stack is LIFO (Last In, First Out), Queue is FIFO (First In, First Out).', points: 5, tags: 'data-structures, stack, queue', options: [
      { label: 'A', text: 'Stack is LIFO, Queue is FIFO', isCorrect: true },
    ]},
    { type: 'ESSAY', difficulty: 'HARD', prompt: 'Compare and contrast REST and GraphQL API design approaches. Discuss use cases where each would be preferred.', explanation: 'REST uses fixed endpoints, GraphQL allows flexible queries. REST is simpler for CRUD, GraphQL excels when clients need varying data shapes.', points: 10, tags: 'api, rest, graphql', options: [
      { label: 'A', text: 'REST uses fixed endpoints, GraphQL allows flexible queries', isCorrect: true },
    ]},
    { type: 'MATCHING', difficulty: 'EXPERT', prompt: 'Match each sorting algorithm with its worst-case time complexity:', explanation: 'QuickSort: O(n²), MergeSort: O(n log n), BubbleSort: O(n²), HeapSort: O(n log n)', points: 4, tags: 'algorithms, sorting', options: [
      { label: 'A', text: 'QuickSort → O(n²)', isCorrect: true },
      { label: 'B', text: 'MergeSort → O(n²)', isCorrect: false },
    ]},
  ],
  'CS201': [
    { type: 'MULTIPLE_CHOICE', difficulty: 'MEDIUM', prompt: 'Which data structure is optimal for implementing a priority queue?', explanation: 'Binary heaps provide O(log n) insertion and extraction for priority queues.', points: 2, tags: 'data-structures, heap', options: [
      { label: 'A', text: 'Linked List', isCorrect: false },
      { label: 'B', text: 'Binary Heap', isCorrect: true },
      { label: 'C', text: 'Hash Table', isCorrect: false },
      { label: 'D', text: 'Stack', isCorrect: false },
    ]},
    { type: 'MULTIPLE_CHOICE', difficulty: 'EASY', prompt: 'What is the time complexity of accessing an element in an array by index?', explanation: 'Arrays provide O(1) random access because elements are stored contiguously.', points: 1, tags: 'arrays, complexity', options: [
      { label: 'A', text: 'O(1)', isCorrect: true },
      { label: 'B', text: 'O(n)', isCorrect: false },
      { label: 'C', text: 'O(log n)', isCorrect: false },
      { label: 'D', text: 'O(n²)', isCorrect: false },
    ]},
    { type: 'TRUE_FALSE', difficulty: 'EASY', prompt: 'A hash table with a good hash function has O(1) average lookup time.', points: 1, tags: 'hashing', options: [
      { label: 'A', text: 'True', isCorrect: true },
      { label: 'B', text: 'False', isCorrect: false },
    ]},
    { type: 'ESSAY', difficulty: 'HARD', prompt: 'Explain how Dijkstra\'s shortest-path algorithm works. Include its time complexity and a real-world application.', explanation: 'Dijkstra uses a priority queue to greedily select the closest unvisited node.', points: 8, tags: 'algorithms, graph', options: [
      { label: 'A', text: 'Uses priority queue for greedy selection of closest node', isCorrect: true },
    ]},
  ],
  'MATH101': [
    { type: 'MULTIPLE_CHOICE', difficulty: 'EASY', prompt: 'What is the derivative of f(x) = x²?', explanation: 'The power rule: d/dx(x^n) = n·x^(n-1), so d/dx(x²) = 2x.', points: 2, tags: 'calculus, derivatives', options: [
      { label: 'A', text: 'x', isCorrect: false },
      { label: 'B', text: '2x', isCorrect: true },
      { label: 'C', text: '2', isCorrect: false },
      { label: 'D', text: 'x²/2', isCorrect: false },
    ]},
    { type: 'MULTIPLE_CHOICE', difficulty: 'MEDIUM', prompt: 'What is ∫₀¹ x² dx?', explanation: '∫x² dx = x³/3, evaluated from 0 to 1 gives 1/3.', points: 3, tags: 'calculus, integration', options: [
      { label: 'A', text: '1/2', isCorrect: false },
      { label: 'B', text: '1/3', isCorrect: true },
      { label: 'C', text: '1', isCorrect: false },
      { label: 'D', text: '0', isCorrect: false },
    ]},
    { type: 'TRUE_FALSE', difficulty: 'MEDIUM', prompt: 'The function f(x) = |x| is differentiable at x = 0.', explanation: 'The absolute value function has a sharp corner at x=0, so it is not differentiable there.', points: 1, tags: 'calculus, continuity', options: [
      { label: 'A', text: 'True', isCorrect: false },
      { label: 'B', text: 'False', isCorrect: true },
    ]},
  ],
  'PHY101': [
    { type: 'MULTIPLE_CHOICE', difficulty: 'EASY', prompt: 'Newton\'s Second Law states that F = ?', explanation: 'Force equals mass times acceleration: F = ma.', points: 1, tags: 'newton, mechanics', options: [
      { label: 'A', text: 'mv', isCorrect: false },
      { label: 'B', text: 'ma', isCorrect: true },
      { label: 'C', text: 'mg', isCorrect: false },
      { label: 'D', text: 'mv²/r', isCorrect: false },
    ]},
    { type: 'MULTIPLE_CHOICE', difficulty: 'MEDIUM', prompt: 'What is the SI unit of force?', explanation: 'The Newton (N) is the SI unit of force: 1 N = 1 kg·m/s².', points: 1, tags: 'units, force', options: [
      { label: 'A', text: 'Joule', isCorrect: false },
      { label: 'B', text: 'Newton', isCorrect: true },
      { label: 'C', text: 'Watt', isCorrect: false },
      { label: 'D', text: 'Pascal', isCorrect: false },
    ]},
    { type: 'ESSAY', difficulty: 'HARD', prompt: 'Explain the conservation of energy using a pendulum as an example. Describe the energy transformations that occur during one complete swing cycle.', explanation: 'At highest point: max PE, zero KE. At lowest point: max KE, zero PE. Energy continuously converts between PE and KE.', points: 6, tags: 'energy, mechanics', options: [
      { label: 'A', text: 'Energy converts between PE and KE continuously', isCorrect: true },
    ]},
  ],
  'BIO101': [
    { type: 'MULTIPLE_CHOICE', difficulty: 'EASY', prompt: 'What organelle is known as the "powerhouse of the cell"?', explanation: 'Mitochondria generate ATP through cellular respiration.', points: 1, tags: 'cell-biology, organelles', options: [
      { label: 'A', text: 'Nucleus', isCorrect: false },
      { label: 'B', text: 'Mitochondria', isCorrect: true },
      { label: 'C', text: 'Ribosome', isCorrect: false },
      { label: 'D', text: 'Golgi apparatus', isCorrect: false },
    ]},
    { type: 'TRUE_FALSE', difficulty: 'EASY', prompt: 'Prokaryotic cells have a membrane-bound nucleus.', explanation: 'Prokaryotes (bacteria and archaea) lack membrane-bound organelles, including a nucleus.', points: 1, tags: 'cell-biology, prokaryotes', options: [
      { label: 'A', text: 'True', isCorrect: false },
      { label: 'B', text: 'False', isCorrect: true },
    ]},
    { type: 'MULTIPLE_SELECT', difficulty: 'MEDIUM', prompt: 'Which of the following are components of the central dogma of molecular biology? (Select all that apply)', explanation: 'The central dogma describes the flow: DNA → RNA → Protein.', points: 3, tags: 'molecular-biology, central-dogma', options: [
      { label: 'A', text: 'DNA replication', isCorrect: true },
      { label: 'B', text: 'Transcription', isCorrect: true },
      { label: 'C', text: 'Translation', isCorrect: true },
      { label: 'D', text: 'Protein folding', isCorrect: false },
    ]},
  ],
  'ENG101': [
    { type: 'MULTIPLE_CHOICE', difficulty: 'EASY', prompt: 'Which literary device is used in "The wind whispered through the trees"?', explanation: 'Personification gives human qualities (whispered) to non-human things (wind).', points: 2, tags: 'poetry, literary-devices', options: [
      { label: 'A', text: 'Simile', isCorrect: false },
      { label: 'B', text: 'Metaphor', isCorrect: false },
      { label: 'C', text: 'Personification', isCorrect: true },
      { label: 'D', text: 'Alliteration', isCorrect: false },
    ]},
    { type: 'SHORT_ANSWER', difficulty: 'MEDIUM', prompt: 'Define iambic pentameter and give one example line.', explanation: 'A line with five iambic feet (unstressed/stressed pairs). Example: "Shall I compare thee to a summer\'s day?"', points: 4, tags: 'poetry, meter', options: [
      { label: 'A', text: 'Five iambic feet per line', isCorrect: true },
    ]},
  ],
};

const userDefs = [
  { email: 'john.doe@oes.local', password: 'Student@123', firstName: 'John', lastName: 'Doe', role: 'STUDENT' as RoleName },
  { email: 'jane.smith@oes.local', password: 'Student@123', firstName: 'Jane', lastName: 'Smith', role: 'STUDENT' as RoleName },
  { email: 'bob.wilson@oes.local', password: 'Student@123', firstName: 'Bob', lastName: 'Wilson', role: 'STUDENT' as RoleName },
  { email: 'alice.johnson@oes.local', password: 'Student@123', firstName: 'Alice', lastName: 'Johnson', role: 'STUDENT' as RoleName },
  { email: 'carol.brown@oes.local', password: 'Student@123', firstName: 'Carol', lastName: 'Brown', role: 'STUDENT' as RoleName },
  { email: 'dr.sarah@oes.local', password: 'Instructor@123', firstName: 'Sarah', lastName: 'Miller', role: 'INSTRUCTOR' as RoleName },
  { email: 'dr.peter@oes.local', password: 'Instructor@123', firstName: 'Peter', lastName: 'Davis', role: 'INSTRUCTOR' as RoleName },
];

async function main() {
  // Create permissions
  const permissionRecords: Record<string, string> = {};
  for (const [key, label, module] of permissions) {
    const p = await prisma.permission.upsert({
      where: { key },
      update: { label, module },
      create: { key, label, module },
    });
    permissionRecords[key] = p.id;
  }

  // Create roles with permissions
  for (const [roleName, permKeys] of Object.entries(rolePermissionsMap)) {
    const role = await prisma.role.upsert({
      where: { name: roleName as RoleName },
      update: {},
      create: { name: roleName as RoleName, description: `${roleName.replace('_', ' ')} role` },
    });
    for (const key of permKeys) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permissionRecords[key] } },
        update: {},
        create: { roleId: role.id, permissionId: permissionRecords[key] },
      });
    }
  }

  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.SUPER_ADMIN } });
  const studentRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.STUDENT } });
  const instructorRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.INSTRUCTOR } });
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.ADMIN } });

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@oes.local' },
    update: {},
    create: {
      email: 'admin@oes.local',
      passwordHash: adminPasswordHash,
      firstName: 'System',
      lastName: 'Admin',
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      roles: { create: { roleId: superAdminRole.id } },
    },
  });

  // Create instructor and student users
  const createdUsers: Record<string, string> = { admin: admin.id };
  for (const def of userDefs) {
    const passwordHash = await bcrypt.hash(def.password, 12);
    const roleId = def.role === RoleName.STUDENT ? studentRole.id : instructorRole.id;
    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: {},
      create: {
        email: def.email,
        passwordHash,
        firstName: def.firstName,
        lastName: def.lastName,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        roles: { create: { roleId } },
      },
    });
    createdUsers[def.email] = user.id;
  }

  // Create subjects and courses
  const subjectRecords: Record<string, string> = {};
  const courseRecords: Record<string, string> = {};
  for (const subj of subjects) {
    const existing = await prisma.subject.findFirst({ where: { code: subj.code, tenantId: null } });
    const subject = existing
      ? await prisma.subject.update({ where: { id: existing.id }, data: { name: subj.name, description: subj.description } })
      : await prisma.subject.create({ data: { code: subj.code, name: subj.name, description: subj.description } });
    subjectRecords[subj.code] = subject.id;
  }
  for (const course of courses) {
    const existing = await prisma.course.findFirst({ where: { code: course.code, tenantId: null } });
    const c = existing
      ? await prisma.course.update({ where: { id: existing.id }, data: { name: course.name, subjectId: subjectRecords[course.subjectCode] } })
      : await prisma.course.create({ data: { code: course.code, name: course.name, subjectId: subjectRecords[course.subjectCode] } });
    courseRecords[course.code] = c.id;
  }

  // Create questions
  const questionRecords: Record<string, string> = {};
  for (const [courseCode, qDefs] of Object.entries(questionsByCourse)) {
    const courseId = courseRecords[courseCode];
    const subjectCode = courses.find(c => c.code === courseCode)!.subjectCode;
    for (let i = 0; i < qDefs.length; i++) {
      const qDef = qDefs[i];
      const question = await prisma.question.create({
        data: {
          subjectId: subjectRecords[subjectCode],
          createdById: admin.id,
          type: qDef.type,
          difficulty: qDef.difficulty,
          prompt: qDef.prompt,
          explanation: qDef.explanation,
          points: qDef.points,
          tags: qDef.tags,
          isActive: true,
          options: {
            create: qDef.options.map((opt, oi) => ({
              label: opt.label,
              text: opt.text,
              isCorrect: opt.isCorrect,
              sortOrder: oi,
            })),
          },
        },
        include: { options: true },
      });
      questionRecords[`${courseCode}_q${i}`] = question.id;
    }
  }

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  // Create exams
  const instructorId = createdUsers['dr.sarah@oes.local'];
  const examDefs = [
    {
      courseCode: 'CS101', title: 'Introduction to Programming - Midterm', slug: 'cs101-midterm',
      durationMinutes: 60, totalMarks: 100, passingMarks: 40,
      startsAt: new Date(now.getTime() - 14 * dayMs), endsAt: new Date(now.getTime() - 7 * dayMs),
      status: ExamStatus.CLOSED, questionKeys: ['CS101_q0', 'CS101_q1', 'CS101_q2', 'CS101_q3'],
    },
    {
      courseCode: 'CS201', title: 'Data Structures - Quiz 1', slug: 'cs201-quiz1',
      durationMinutes: 30, totalMarks: 50, passingMarks: 20,
      startsAt: new Date(now.getTime() - 7 * dayMs), endsAt: new Date(now.getTime() - 1 * dayMs),
      status: ExamStatus.CLOSED, questionKeys: ['CS201_q0', 'CS201_q1', 'CS201_q2'],
    },
    {
      courseCode: 'CS101', title: 'Introduction to Programming - Final', slug: 'cs101-final',
      durationMinutes: 120, totalMarks: 100, passingMarks: 50,
      startsAt: new Date(now.getTime() + 7 * dayMs), endsAt: new Date(now.getTime() + 14 * dayMs),
      status: ExamStatus.PUBLISHED, questionKeys: ['CS101_q0', 'CS101_q1', 'CS101_q2', 'CS101_q3', 'CS101_q4', 'CS101_q5'],
    },
    {
      courseCode: 'MATH101', title: 'Calculus I - Exam 1', slug: 'math101-exam1',
      durationMinutes: 90, totalMarks: 75, passingMarks: 30,
      startsAt: new Date(now.getTime() - 30 * dayMs), endsAt: new Date(now.getTime() - 23 * dayMs),
      status: ExamStatus.CLOSED, questionKeys: ['MATH101_q0', 'MATH101_q1', 'MATH101_q2'],
    },
    {
      courseCode: 'BIO101', title: 'Cell Biology - Chapter Test', slug: 'bio101-ch1',
      durationMinutes: 45, totalMarks: 60, passingMarks: 30,
      startsAt: new Date(now.getTime() - 2 * dayMs), endsAt: new Date(now.getTime() + 10 * dayMs),
      status: ExamStatus.PUBLISHED, questionKeys: ['BIO101_q0', 'BIO101_q1', 'BIO101_q2'],
    },
    {
      courseCode: 'ENG101', title: 'Poetry Analysis - Draft', slug: 'eng101-draft',
      durationMinutes: 60, totalMarks: 50, passingMarks: 25,
      startsAt: new Date(now.getTime() + 14 * dayMs), endsAt: new Date(now.getTime() + 21 * dayMs),
      status: ExamStatus.DRAFT, questionKeys: ['ENG101_q0', 'ENG101_q1'],
    },
  ];

  const examRecords: Array<{ id: string; title: string }> = [];
  for (const def of examDefs) {
    const exam = await prisma.exam.upsert({
      where: { slug: def.slug },
      update: {
        startsAt: def.startsAt,
        endsAt: def.endsAt,
        status: def.status,
      },
      create: {
        courseId: courseRecords[def.courseCode],
        createdById: instructorId,
        title: def.title,
        slug: def.slug,
        description: `${def.title} examination`,
        durationMinutes: def.durationMinutes,
        totalMarks: def.totalMarks,
        passingMarks: def.passingMarks,
        negativeMarkingRate: 0.25,
        attemptsAllowed: 1,
        randomizeQuestions: false,
        randomizeOptions: false,
        fullscreenRequired: true,
        showResultImmediately: true,
        startsAt: def.startsAt,
        endsAt: def.endsAt,
        status: def.status,
        questions: {
          create: def.questionKeys.map((qk, i) => ({
            questionId: questionRecords[qk],
            points: i < 3 ? 2 : 1,
            sortOrder: i,
          })),
        },
      },
    });
    examRecords.push({ id: exam.id, title: exam.title });
  }

  const studentIds = [
    createdUsers['john.doe@oes.local'],
    createdUsers['jane.smith@oes.local'],
    createdUsers['bob.wilson@oes.local'],
    createdUsers['alice.johnson@oes.local'],
    createdUsers['carol.brown@oes.local'],
  ];

  // Assign all students to PUBLISHED/LIVE exams
  const publishableExams = examRecords.filter((_, i) =>
    examDefs[i].status === ExamStatus.PUBLISHED
  );
  for (const exam of publishableExams) {
    for (const sid of studentIds) {
      await prisma.examAssignment.upsert({
        where: { examId_studentId: { examId: exam.id, studentId: sid } },
        update: {},
        create: { examId: exam.id, studentId: sid },
      });
    }
  }

  const closedExams = examDefs.filter(e => e.status === ExamStatus.CLOSED);
  for (let ei = 0; ei < closedExams.length; ei++) {
    const examDef = closedExams[ei];
    const examId = examRecords.find(e => e.title === examDef.title)!.id;

    for (let si = 0; si < studentIds.length; si++) {
      const studentId = studentIds[si];
      const score = Math.round(30 + Math.random() * 60);
      const maxScore = examDef.totalMarks;
      const percentage = Math.round((score / maxScore) * 100);
      const passed = percentage >= 50;

      const session = await prisma.examSession.upsert({
        where: {
          examId_studentId_attemptNumber: {
            examId, studentId, attemptNumber: 1,
          },
        },
        update: {},
        create: {
          examId,
          studentId,
          attemptNumber: 1,
          status: SessionStatus.SUBMITTED,
          startedAt: new Date(examDef.startsAt.getTime() + dayMs),
          expiresAt: new Date(examDef.startsAt.getTime() + dayMs + examDef.durationMinutes * 60 * 1000),
          submittedAt: new Date(examDef.startsAt.getTime() + dayMs + examDef.durationMinutes * 60 * 1000 - Math.random() * 10 * 60 * 1000),
          remainingSeconds: 0,
          questionOrder: JSON.stringify(examDef.questionKeys),
          optionOrder: JSON.stringify({}),
        },
      });

      const submission = await prisma.submission.upsert({
        where: { sessionId: session.id },
        update: {},
        create: {
          sessionId: session.id,
          status: SubmissionStatus.GRADED,
          submittedAt: session.submittedAt ?? new Date(),
          autoSubmitted: false,
          totalScore: score,
          maxScore,
          percentage,
          isPassed: passed,
          gradingCompletedAt: new Date(),
        },
      });

      await prisma.result.upsert({
        where: { submissionId: submission.id },
        update: {},
        create: {
          submissionId: submission.id,
          examId,
          studentId,
          score,
          maxScore,
          percentage,
          grade: percentage >= 80 ? 'A' : percentage >= 65 ? 'B' : percentage >= 50 ? 'C' : 'D',
          passed,
          publishedAt: new Date(),
        },
      });

      // Add certificates for top performers
      if (percentage >= 80) {
        const certNo = `CERT-${String(ei + 1).padStart(3, '0')}-${String(si + 1).padStart(3, '0')}`;
        const existingResult = await prisma.result.findFirst({
          where: { submissionId: submission.id },
        });
        if (existingResult && !(await prisma.certificate.findFirst({ where: { resultId: existingResult.id } }))) {
          await prisma.certificate.create({
            data: {
              resultId: existingResult.id,
              certificateNo: certNo,
              verificationCode: `VERIFY-${certNo}-${randomUUID().slice(0, 8)}`,
              issuedAt: new Date(),
            },
          });
        }
      }

      // Create notifications for results
      await prisma.notification.create({
        data: {
          userId: studentId,
          type: 'RESULT_PUBLISHED',
          title: 'Exam Result Published',
          message: `Your result for "${examDef.title}" is now available. Score: ${score}/${maxScore} (${percentage}%)`,
        },
      });
    }
  }

  // Create admin notification
  await prisma.notification.create({
    data: {
      userId: admin.id,
      type: 'SYSTEM',
      title: 'System Setup Complete',
      message: 'The Online Examination System has been initialized with sample data. Review the dashboard for an overview.',
    },
  });

  // Create some violations for monitoring demo
  const sampleSessions = await prisma.examSession.findMany({ take: 3 });
  for (const s of sampleSessions) {
    await prisma.examViolation.create({
      data: {
        sessionId: s.id,
        type: ViolationType.TAB_SWITCH,
        severity: 1,
        details: JSON.stringify({ message: 'Student switched browser tab', timestamp: new Date().toISOString() }),
      },
    });
  }
}

function randomUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

main()
  .then(async () => {
    console.log('Seed completed successfully');
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
