import type { Catalog } from '../shared/domain';

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
