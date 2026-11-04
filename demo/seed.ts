import type { Catalog, Listing, Role } from '../shared/domain';

export const catalog: Catalog = {
  city: 'Guwahati, Assam',
  center: { lat: 26.168, lng: 91.765 },
  defaultLocality: 'rajgarh',
  localities: [
    { id: 'rajgarh', name: 'Rajgarh', lat: 26.1743, lng: 91.7661 },
    { id: 'chandmari', name: 'Chandmari', lat: 26.1843, lng: 91.771 },
    { id: 'zoo-road', name: 'Zoo Road', lat: 26.1705, lng: 91.7838 },
    { id: 'ulubari', name: 'Ulubari', lat: 26.1677, lng: 91.754 },
    { id: 'beltola', name: 'Beltola', lat: 26.1278, lng: 91.807 },
    { id: 'dispur', name: 'Dispur', lat: 26.1448, lng: 91.7897 },
    { id: 'ganeshguri', name: 'Ganeshguri', lat: 26.1536, lng: 91.7823 },
    { id: 'silpukhuri', name: 'Silpukhuri', lat: 26.1861, lng: 91.7608 },
    { id: 'paltan-bazaar', name: 'Paltan Bazaar', lat: 26.1756, lng: 91.7508 },
    { id: 'uzan-bazaar', name: 'Uzan Bazaar', lat: 26.1944, lng: 91.7535 },
    { id: 'birubari', name: 'Birubari', lat: 26.1555, lng: 91.7473 },
  ],
  subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Science', 'Computer Science', 'Assamese', 'Social Studies'],
  grades: ['Classes 1–5', 'Classes 6–8', 'Classes 9–10', 'Classes 11–12', 'College'],
  workspaces: {
    student: { id: 'demo-student', role: 'student', name: 'Aditi', initials: 'AD' },
    teacher: { id: 'demo-teacher', role: 'teacher', name: 'Arjun', initials: 'AR' },
  },
  demo: true,
};

type Seed = [id: string, name: string, headline: string, localityId: string, subjects: string[], grades: number[], rate: number, availability: string, description: string, color: string];
const teachers: Seed[] = [
  ['t-riya', 'Riya Sharma', 'Maths & Physics tutor', 'rajgarh', ['Mathematics', 'Physics'], [2, 3], 550, 'Weekday evenings', 'I help students turn tricky concepts into simple steps. Sessions combine worked examples with practice at your pace. I can help with board exams, weekly revision and building confidence in problem solving.', 'lilac'],
  ['t-arindam', 'Arindam Das', 'Science & Maths tutor', 'silpukhuri', ['Science', 'Mathematics'], [1, 2], 450, 'Mon, Wed & weekends', 'I work with middle and secondary school students on foundations in maths and science. I start with what you already know and build from there with exercises and short reviews.', 'peach'],
  ['t-meghna', 'Meghna Bora', 'English & reading tutor', 'zoo-road', ['English', 'Social Studies'], [0, 1], 400, 'After school', 'I use stories, guided reading and conversation to help younger learners feel comfortable with English. I also support homework and writing practice.', 'sage'],
  ['t-niloy', 'Niloy Deka', 'Physics & Chemistry tutor', 'ulubari', ['Physics', 'Chemistry'], [2, 3], 650, 'Weekends', 'Hands-on explanations and structured practice for school science. We can focus on a particular chapter, prepare for exams, or set up a regular weekly routine.', 'blue'],
  ['t-jahnavi', 'Jahnavi Hazarika', 'Biology & Science tutor', 'chandmari', ['Biology', 'Science'], [1, 2, 3], 500, 'Tue & Thu evenings', 'I bring diagrams and clear notes to each session. I enjoy helping students see how topics connect and understand what exam questions are asking.', 'peach'],
  ['t-rahul', 'Rahul Kalita', 'Coding & Maths tutor', 'ganeshguri', ['Computer Science', 'Mathematics'], [2, 3, 4], 700, 'Flexible weekdays', 'Learn coding and maths through small projects and worked examples. I teach Python and school-level problem solving.', 'lilac'],
  ['t-ananya', 'Ananya Saikia', 'Primary school tutor', 'uzan-bazaar', ['English', 'Assamese', 'Mathematics'], [0], 350, 'Weekday afternoons', 'Friendly tuition for early readers and primary school learners. We practise core skills through short activities.', 'sage'],
  ['t-saurav', 'Saurav Baruah', 'Maths & Physics tutor', 'beltola', ['Mathematics', 'Physics'], [2, 3], 600, 'Saturday & Sunday', 'I offer regular maths and physics support for secondary school and board exam students, with time to review questions from class.', 'blue'],
];
const students: Seed[] = [
  ['s-kashyap', 'Kashyap family', 'Looking for a Maths tutor', 'rajgarh', ['Mathematics'], [2], 550, 'Weekday evenings', 'Looking for a tutor for Class 10 maths, twice a week after school. We would like to start with algebra and exam-style questions.', 'sage'],
  ['s-dutta', 'Dutta family', 'English reading support', 'silpukhuri', ['English'], [0], 400, 'After school', 'We are looking for gentle reading and writing practice for a primary school learner. Two short lessons a week would work well.', 'blue'],
  ['s-bora', 'Bora family', 'Physics & Chemistry tuition', 'zoo-road', ['Physics', 'Chemistry'], [3], 700, 'Weekends', 'Looking for regular support with Class 11 science and help with numerical problems. Weekend mornings are best for us.', 'peach'],
  ['s-roy', 'Roy family', 'Science homework support', 'chandmari', ['Science'], [1], 450, 'Mon & Wed evenings', 'We want help understanding classroom science and keeping up with homework.', 'lilac'],
  ['s-kalita', 'Kalita family', 'Computer Science lessons', 'ganeshguri', ['Computer Science'], [3], 650, 'Flexible weekdays', 'Looking for a Python tutor who can explain core programming concepts and guide us through a few small projects.', 'blue'],
  ['s-saikia', 'Saikia family', 'Assamese & English tuition', 'paltan-bazaar', ['Assamese', 'English'], [0, 1], 500, 'Weekday afternoons', 'We would like regular language practice with a tutor who can build confidence in reading and conversation.', 'sage'],
];
function makeListings(role: Role, records: Seed[]): Listing[] {
  return records.map(([id, name, headline, localityId, subjects, grades, rate, availability, description, color], index) => {
    const locality = catalog.localities.find((area) => area.id === localityId)!;
    return { id, role, name, headline, localityId, subjects, grades: grades.map((grade) => catalog.grades[grade]), rate,
      availability, description, published: true, avatar: index + 1, color, locality: locality.name, location: { lat: locality.lat, lng: locality.lng } };
  });
}
export const seedListings = [...makeListings('teacher', teachers), ...makeListings('student', students)];
