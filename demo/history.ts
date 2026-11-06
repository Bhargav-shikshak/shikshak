import type { DemoState } from './api';
import { catalog } from './seed';
import { seedListings } from './fixtures';
import type { Classroom, Homework, LessonNote, Message, Role } from '../shared/domain';

/**
 * One-time browser-local pilot history. Nothing here is injected into the UI;
 * the browser demo converts these templates into normal persisted accounts,
 * then stores its relationships, notes and activity in the existing state.
 *
 * All identities and messages are synthetic. Generated dates span ~5 months.
 */
export interface HistoryProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  localityId: string;
  subjects: string[];
  grades: string[];
  headline: string;
  availability: string;
  description: string;
  bio: string;
  qualifications: string;
  experience: string;
  strongSubjects: string[];
  weakSubjects: string[];
  budget: number;
}

const tutorNames = [
  'Nandita Deka', 'Kunal Hazarika', 'Priyanka Das', 'Hemanta Bora',
  'Ishita Goswami', 'Ritwick Saikia', 'Moumi Sarma', 'Siddharth Kalita',
  'Ankita Baruah', 'Subham Dutta', 'Jyotika Nath', 'Nayan Talukdar',
  'Palak Choudhury', 'Debajit Pegu', 'Anuradha Borthakur', 'Zubeen Ahmed',
  'Trisha Bhuyan', 'Bishal Gogoi', 'Manisha Rajbongshi', 'Dipankar Mahanta',
  'Pallabi Basumatary', 'Arup Sharma',
];
const familyNames = [
  'Kakati household', 'Boruah household', 'Bhuyan household', 'Gogoi household',
  'Deka household', 'Borthakur household', 'Nath household', 'Moran household',
  'Sarma household', 'Mahanta household', 'Pegu household', 'Saikia household',
  'Hazarika household', 'Talukdar household', 'Goswami household', 'Barman household',
  'Basumatary household', 'Kalita household', 'Ahmed household', 'Tamuli household',
  'Chetia household', 'Pathak household', 'Sutradhar household', 'Rabha household',
  'Laskar household', 'Sengupta household', 'Choudhury household', 'Barua household',
];
const subjectGroups: string[][] = [
  ['Mathematics', 'Physics'], ['English', 'Social Studies'],
  ['Chemistry', 'Biology'], ['Science', 'Mathematics'],
  ['Computer Science', 'Mathematics'], ['Assamese', 'English'],
  ['Physics', 'Chemistry'], ['Biology', 'Science'],
  ['English', 'Mathematics'], ['Social Studies', 'Assamese'],
];
const classGroups: string[][] = [
  ['Classes 9–10', 'Classes 11–12'], ['Classes 1–5', 'Classes 6–8'],
  ['Classes 6–8', 'Classes 9–10'], ['Classes 11–12', 'College'],
  ['Classes 9–10', 'College'], ['Classes 6–8', 'Classes 11–12'],
];
const availability = [
  'Monday to Thursday evenings', 'Weekend mornings', 'After school',
  'Tuesday and Friday afternoons', 'Flexible weekday evenings',
  'Saturday and Sunday', 'Mon, Wed and Fri evenings',
];
const experiences = ['2 years', '3 years', '5 years', '7 years', '4 years', '6 years'];
const qualifications = ['BSc', 'BA', 'MSc', 'MA', 'BEd', 'MCA'];
const subjectsLabel = (subjects: string[]) => subjects.join(' and ');

export const historyProfiles: HistoryProfile[] = [
  ...tutorNames.map((name, index): HistoryProfile => {
    const subjects = subjectGroups[index % subjectGroups.length];
    const grades = classGroups[index % classGroups.length];
    return {
      id: 'months-t-' + String(index + 1).padStart(2, '0'),
      name,
      email: 'months-teacher-' + (index + 1) + '@shikshak.demo',
      role: 'teacher',
      localityId: catalog.localities[(index * 3 + 2) % catalog.localities.length].id,
      subjects, grades,
      headline: subjectsLabel(subjects) + ' · ' + grades[0] + ' tutor',
      availability: availability[(index + 2) % availability.length],
      description: [
        'Topic-by-topic lessons with clear examples, revision planning and short practice tasks.',
        'Personalised support for fundamentals, regular quizzes and exam preparation.',
        'Structured weekly tuition with worked solutions and feedback on homework.',
        'Practice-first teaching with concept summaries and progress check-ins.',
      ][index % 4] + ' Focus: ' + subjectsLabel(subjects) + '.',
      bio: 'I teach ' + subjectsLabel(subjects) + ' and help learners build a steady study routine.',
      qualifications: qualifications[index % qualifications.length],
      experience: experiences[index % experiences.length] + ' of tutoring',
      strongSubjects: [],
      weakSubjects: [],
      budget: 400,
    };
  }),
  ...familyNames.map((name, index): HistoryProfile => {
    const subjects = subjectGroups[(index * 3 + 1) % subjectGroups.length];
    const classLevel = catalog.grades[(index + (index % 3)) % catalog.grades.length];
    const strong = subjectGroups[(index + 4) % subjectGroups.length]
      .find(subject => !subjects.includes(subject)) ?? 'English';
    return {
      id: 'months-s-' + String(index + 1).padStart(2, '0'),
      name,
      email: 'months-student-' + (index + 1) + '@shikshak.demo',
      role: 'student',
      localityId: catalog.localities[(index * 5 + 1) % catalog.localities.length].id,
      subjects, grades: [classLevel],
      headline: 'Looking for ' + subjectsLabel(subjects) + ' support',
      availability: availability[index % availability.length],
      description: [
        'Seeking a patient tutor for regular lessons, revision and feedback on progress.',
        'Looking for help understanding classroom topics and preparing for assessments.',
        'Would like weekly practice, clearer explanations and structured homework support.',
        'Interested in a consistent tutoring plan and periodic progress check-ins.',
      ][index % 4] + ' Priority subjects: ' + subjectsLabel(subjects) + '.',
      bio: 'Family-managed fictional learner profile, used to test tutoring and homework coordination.',
      qualifications: '', experience: '',
      strongSubjects: [strong], weakSubjects: [...subjects],
      budget: 400 + (index % 6) * 75,
    };
  }),
];

const topicDetails: Record<string, [string, string]> = {
  Mathematics: ['Linear equations', 'Rearrange terms, isolate the unknown, and verify each answer by substitution.'],
  Physics: ['Motion and forces', 'Review units, sketch the forces, then apply the correct formula with labelled steps.'],
  Chemistry: ['Chemical reactions', 'Balance equations by counting atoms on both sides before calculating quantities.'],
  Biology: ['Cells and life processes', 'Draw a labelled diagram, then compare the functions of key structures.'],
  English: ['Reading and writing', 'Identify the main idea, support it with evidence, and revise the final paragraph.'],
  Science: ['Scientific method', 'Record observations, state a hypothesis, and explain the result in your own words.'],
  'Computer Science': ['Programming foundations', 'Break the problem into small functions, trace variables and test edge cases.'],
  Assamese: ['Language and comprehension', 'Practise a short passage, note new vocabulary and explain its meaning.'],
  'Social Studies': ['Geography and history', 'Build a timeline or map with key facts, causes and outcomes.'],
};

function iso(now: number, daysFromNow: number, hour = 16): string {
  const day = new Date(now + daysFromNow * 86_400_000);
  day.setHours(hour, 0, 0, 0);
  return day.toISOString();
}
const keyFor = (a: string, b: string) => [a, b].sort().join(':');
const appendUnique = (items: string[] | undefined, item: string): string[] =>
  items?.includes(item) ? items : [...(items ?? []), item];

function subjectOverlap(a: string[], b: string[]): number {
  return a.filter(subject => b.includes(subject)).length;
}

/** Return aggregate counts for testing, not business analytics. */
export function addHistoricalActivity(state: DemoState, now = Date.now()) {
  const preservedTestEmails = [
    'student@shikshak.demo', 'teacher@shikshak.demo',
    'meghna@shikshak.demo', 'rohan@shikshak.demo',
  ];
  const fixtureIds = new Set(seedListings.map(item => item.id));
  const historyIds = new Set(historyProfiles.map(item => item.id));
  const included = Object.values(state.accounts).filter(account =>
    account.active && state.own[account.id]?.published && (
      fixtureIds.has(account.id) ||
      historyIds.has(account.id) ||
      preservedTestEmails.includes(account.email)
    ),
  );
  const teachers = included.filter(account => account.role === 'teacher');
  const students = included.filter(account => account.role === 'student');
  const pairs: [string, string][] = [];
  const pairIds = new Set<string>();

  // Established tutor-learner pairs chosen by shared subjects/grade, not
  // random incompatible matches. Skip any unreciprocated user interest.
  for (const [studentIndex, student] of students.entries()) {
    const studentListing = state.own[student.id];
    const candidates = teachers
      // Keep Aditi -> Rahul unpaired so the two-way matching tutorial remains demonstrable.
      .filter(teacher => !(student.email === 'student@shikshak.demo' && teacher.id === 't-rahul'))
      .filter(teacher => subjectOverlap(state.own[teacher.id].subjects, studentListing.subjects) > 0)
      .map(teacher => {
        const tutorListing = state.own[teacher.id];
        const subject = subjectOverlap(tutorListing.subjects, studentListing.subjects);
        const grades = subjectOverlap(tutorListing.grades, studentListing.grades);
        const locality = tutorListing.localityId === studentListing.localityId ? 1 : 0;
        const diversity = (studentIndex * 7 + tutorListing.name.length) % 6;
        return { teacher, score: subject * 6 + grades * 5 + locality * 3 + diversity };
      })
      .filter(result => result.score >= 7 && subjectOverlap(state.own[result.teacher.id].grades, studentListing.grades) > 0)
      .sort((a, b) => b.score - a.score || a.teacher.id.localeCompare(b.teacher.id));

    const target = student.email === 'student@shikshak.demo' ? 4 : 1 + (studentIndex % 3);
    let count = 0;
    for (const { teacher } of candidates) {
      if (count >= target) break;
      const id = keyFor(student.id, teacher.id);
      if (pairIds.has(id)) continue;
      const teacherInterest = state.interests[teacher.id]?.includes(student.id);
      const studentInterest = state.interests[student.id]?.includes(teacher.id);
      if (teacherInterest !== studentInterest) continue;
      state.interests[teacher.id] = appendUnique(state.interests[teacher.id], student.id);
      state.interests[student.id] = appendUnique(state.interests[student.id], teacher.id);
      pairs.push([teacher.id, student.id]);
      pairIds.add(id);
      count++;
    }
  }

  // Preserve the familiar initial match regardless of ranking, and age its
  // classroom alongside the larger dataset.
  const originalTeacher = teachers.find(account => account.email === 'teacher@shikshak.demo');
  const originalStudent = students.find(account => account.email === 'student@shikshak.demo');
  if (originalTeacher && originalStudent) {
    const id = keyFor(originalTeacher.id, originalStudent.id);
    const t = state.interests[originalTeacher.id]?.includes(originalStudent.id);
    const s = state.interests[originalStudent.id]?.includes(originalTeacher.id);
    const accepted = Object.values(state.bookings ?? {}).some(b =>
      b.teacherId === originalTeacher.id && b.studentId === originalStudent.id && b.status === 'accepted');
    if ((accepted || (t && s)) && !pairIds.has(id)) {
      pairs.unshift([originalTeacher.id, originalStudent.id]);
      pairIds.add(id);
    }
  }

  // A scattering of one-sided interests populates Received/Sent tabs. Do not
  // overwrite existing user-initiated connection statuses.
  let unreciprocated = 0;
  for (const [index, student] of students.entries()) {
    const candidate = teachers[(index * 5 + 3) % teachers.length];
    if (!candidate) continue;
    const pair = keyFor(student.id, candidate.id);
    if (student.email === 'student@shikshak.demo' && candidate.id === 't-rahul') continue;
    if (pairIds.has(pair) || state.interests[student.id]?.includes(candidate.id) ||
        state.interests[candidate.id]?.includes(student.id)) continue;
    if (index % 2 === 0) state.interests[student.id] = appendUnique(state.interests[student.id], candidate.id);
    else state.interests[candidate.id] = appendUnique(state.interests[candidate.id], student.id);
    unreciprocated++;
  }

  let sessionsAdded = 0;
  let messagesAdded = 0;
  let notesAdded = 0;
  let homeworkAdded = 0;
  for (const [pairIndex, [teacherId, studentId]] of pairs.entries()) {
    const key = keyFor(teacherId, studentId);
        const subjects = state.own[teacherId].subjects.filter(x => state.own[studentId].subjects.includes(x));
    const subject = subjects[pairIndex % subjects.length] ?? state.own[teacherId].subjects[0];
    const [topic, help] = topicDetails[subject] ?? topicDetails.Mathematics;
    const room: Classroom = state.classrooms[key] ?? {
      studentId, teacherId, sessions: [], notes: [], homework: [],
    };
    state.classrooms[key] = room;

    const months = 140 - ((pairIndex * 11) % 60);
    const historicalSessionCount = 3 + (pairIndex % 4);
    for (let j = 0; j < historicalSessionCount; j++) {
      const id = 'history-session-' + pairIndex + '-' + j;
      if (room.sessions.some(item => item.id === id)) continue;
      room.sessions.push({
        id,
        title: [topic + ' practice', subject + ' revision', 'Progress check-in', topic + ' exercises'][j % 4],
        startsAt: iso(now, -(months - j * 12), 15 + (pairIndex % 4)),
        durationMinutes: [45, 60, 75][(j + pairIndex) % 3],
        status: j % 9 === 3 ? 'cancelled' : 'completed',
        createdAt: iso(now, -(months - j * 12 + 3), 11),
      });
      sessionsAdded++;
    }
    if (pairIndex % 3 !== 0) {
      const id = 'history-upcoming-' + pairIndex;
      if (!room.sessions.some(item => item.id === id)) {
        room.sessions.push({
          id, title: subject + ': next lesson', startsAt: iso(now, 1 + (pairIndex % 11), 15 + (pairIndex % 4)),
          durationMinutes: 60, status: 'scheduled',
          createdAt: iso(now, -1 - (pairIndex % 5), 10),
        });
        sessionsAdded++;
      }
    }
    for (let j = 0; j < 2 + (pairIndex % 3); j++) {
      const id = 'history-note-' + pairIndex + '-' + j;
      if (room.notes.some(item => item.id === id)) continue;
      const note: LessonNote = {
        id, title: [topic + ' — revision sheet', subject + ' study checklist', 'Lesson recap: ' + topic][j % 3],
        content: help + '\n\nPractice plan: explain each step aloud, try two independent questions, and bring any doubts to the next class.',
        createdAt: iso(now, -(months - j * 16), 18),
      };
      room.notes.push(note); notesAdded++;
    }
    for (let j = 0; j < 2 + (pairIndex % 3); j++) {
      const id = 'history-homework-' + pairIndex + '-' + j;
      if (room.homework.some(item => item.id === id)) continue;
      const daysAgo = j === 2 ? 1 + (pairIndex % 3) : 80 - ((pairIndex * 3 + j * 29) % 68);
      const createdAt = iso(now, -(daysAgo + 7), 12);
      const dueAt = iso(now, -daysAgo + 2, 19);
      const finished = j !== 2 && ((pairIndex + j) % 5 !== 0);
      const submitted = finished || ((pairIndex + j) % 4 === 0);
      const reviewed = finished && (pairIndex + j) % 4 !== 1;
      const task: Homework = {
        id,
        title: [topic + ': practice set', 'Review questions — ' + subject, 'Next class preparation'][j % 3],
        instructions: 'Complete three questions on ' + topic.toLowerCase() + '. Show your working and write one question to discuss with your tutor.',
        dueAt, createdAt,
        submission: submitted ? 'Completed the exercises and checked my answers. I would like more help with the last question.' : '',
        submittedAt: submitted ? iso(now, -(daysAgo - 1), 18) : null,
        review: reviewed ? 'Good progress. Keep showing the steps; revisit the last example before our next lesson.' : '',
        reviewedAt: reviewed ? iso(now, -(daysAgo - 3), 20) : null,
      };
      room.homework.push(task); homeworkAdded++;
    }

    const chat = state.messages[key] ?? [];
    const phrases = [
      [teacherId, 'Hello! I can help with ' + subject + '. What would you like to focus on first?'],
      [studentId, 'We would like regular ' + subject + ' practice and guidance with schoolwork.'],
      [teacherId, 'That works. We can begin with ' + topic.toLowerCase() + ' and build a weekly plan.'],
      [studentId, 'Thanks! The evening class time works for us.'],
      [teacherId, 'I have shared revision notes and a short practice set in our classroom.'],
      [studentId, 'I have reviewed the notes. I will submit the answers before our next lesson.'],
      [teacherId, 'Your progress is improving. Please bring one question you found difficult.'],
      [studentId, 'Understood. Looking forward to the next class.'],
    ] as const;
    const messageCount = 5 + (pairIndex % 4);
    for (let j = 0; j < messageCount; j++) {
      const id = 'history-message-' + pairIndex + '-' + j;
      if (chat.some(item => item.id === id)) continue;
      const [authorId, body] = phrases[j];
      const message: Message = {
        id, authorId, body,
        sentAt: iso(now, -(months - j * 9), 12 + (j % 7)),
      };
      chat.push(message);
      messagesAdded++;
    }
    chat.sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    state.messages[key] = chat;

    if (pairIndex % 3 === 0) {
      state.saves[studentId] = appendUnique(state.saves[studentId], teacherId);
      state.saves[teacherId] = appendUnique(state.saves[teacherId], studentId);
    }
  }


  return {
    newPairs: pairs.length, pendingInterest: unreciprocated,
    sessions: sessionsAdded, messages: messagesAdded,
    notes: notesAdded, homework: homeworkAdded,
  };
}
