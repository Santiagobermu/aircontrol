import { db, storage } from '../utils/firebase.js';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { getAllShiftsForController, generateICS, uploadCalendarToStorage, syncAllEnabledCalendars } from '../utils/calendarExport.js';

console.log('Fetching controllers, schedule, and exceptions from Firestore...');
const ctrlSnap = await getDocs(collection(db, 'controllers'));
const controllers = [];
ctrlSnap.forEach(d => controllers.push({ id: d.id, ...d.data() }));

const schedSnap = await getDocs(collection(db, 'schedule'));
const schedule = {};
schedSnap.forEach(d => { schedule[d.id] = d.data(); });

const excSnap = await getDocs(collection(db, 'exceptions'));
const exceptions = {};
excSnap.forEach(d => { exceptions[d.id] = d.data(); });

console.log(`Loaded ${controllers.length} controllers, ${Object.keys(schedule).length} scheduled days, ${Object.keys(exceptions).length} exception docs.`);

console.log('\nControllers with calendar sync enabled:');
const syncControllers = controllers.filter(c => c.calendarSyncEnabled);
console.log(`Found ${syncControllers.length} controllers with calendarSyncEnabled = true:`);
syncControllers.forEach(c => {
  console.log(`- ${c.name} (${c.signature || c.id}) -> ID: ${c.id}`);
});

console.log('\nRegenerating and uploading ALL calendars with "Amanecida" now...');
for (const ctrl of controllers) {
  if (ctrl.calendarSyncEnabled) {
    const allShifts = getAllShiftsForController(ctrl, schedule, exceptions);
    const ics = generateICS(ctrl, allShifts);
    const targetId = ctrl.id || ctrl.signature;
    const downloadUrl = await uploadCalendarToStorage(targetId, ics);
    console.log(`✓ Updated calendar for ${ctrl.name} (${targetId}) -> ${downloadUrl}`);
    
    // Also save calendarSyncUrl to firestore if not set
    if (ctrl.calendarSyncUrl !== downloadUrl) {
      await setDoc(doc(db, 'controllers', ctrl.id), { ...ctrl, calendarSyncUrl: downloadUrl }, { merge: true });
    }
  }
}

console.log('\nAll enabled calendars successfully synced to Firebase Storage with Amanecida!');
process.exit(0);
