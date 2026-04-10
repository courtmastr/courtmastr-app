/**
 * TNF 2026 Tournament Seed - Core Logic
 *
 * Reads the 2026 TNF registration workbook and seeds a tournament scaffold
 * with categories, courts, players, and approved registrations.
 */

import path from 'node:path';
import XLSX from 'xlsx';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { seedGlobalPlayer } from './helpers';

type PlayerGender = 'male' | 'female';

interface CategoryInfo {
  id: string;
  key: string;
  name: string;
}

interface RawParticipant {
  name: string;
  email: string;
  phone: string;
  city: string;
  level: string;
}

interface RawRegistration {
  categoryKey: string;
  participants: RawParticipant[];
  entryId: string;
  seed: number | null;
}

interface ParsedRegistration {
  categoryKey: string;
  participants: SeedParticipant[];
  entryId: string;
  seed: number | null;
}

interface SeedParticipant extends RawParticipant {
  seedEmail: string;
}

interface CategorySeedConfig {
  key: string;
  name: string;
  type: 'singles' | 'doubles' | 'mixed_doubles';
  gender: 'men' | 'women' | 'mixed' | 'open';
  selectColumn: number;
  dataStartColumn: number;
}

export interface TNF2026SeedConfig {
  db: Firestore;
  adminId: string;
  orgId?: string;
  organizerIds?: string[];
  tournamentName?: string;
  workbookPath?: string;
  startDateOffset?: number;
}

export const TNF_2026_ORG_NAME = 'Tamilnadu Foundation (TNF)';
export const TNF_2026_ORG_SLUG = 'tnf';
export const TNF_2026_TOURNAMENT_NAME = 'TNF Badminton - 2026';
export const TNF_2026_WORKBOOK_FILENAME = 'TNF_Final_List_2026.xlsx';

const TNF_2026_WOMENS_DOUBLES_CORRECTIONS: ReadonlyArray<{
  participants: [RawParticipant, RawParticipant];
  seed: number;
}> = [
  {
    participants: [
      {
        name: 'Melanie Arteman',
        email: 'bluehorn@hotmail.com',
        phone: '7187044447',
        city: 'Peoria',
        level: 'Intermediate',
      },
      {
        name: 'Donna Shippy',
        email: 'Shippydms@gmail.com',
        phone: '3092422522',
        city: 'Peoria',
        level: 'Intermediate',
      },
    ],
    seed: 1,
  },
  {
    participants: [
      {
        name: 'Kavitha Vengala',
        email: 'kavitha.vengala.us@gmail.com',
        phone: '(309) 807-7213',
        city: 'Normal',
        level: 'Intermediate',
      },
      {
        name: 'Nikitha Nelakuditi',
        email: 'kavitha.vengala.us@gmail.com',
        phone: '2177619681',
        city: 'Normal',
        level: 'Intermediate',
      },
    ],
    seed: 2,
  },
  {
    participants: [
      {
        name: 'Shrushti Sawant',
        email: 'shrushtisawant.us@gmail.com',
        phone: '8482132602',
        city: 'Chicago',
        level: 'Intermediate',
      },
      {
        name: 'Keerthika Vijayakumar',
        email: 'keerthika24111999@gmail.com',
        phone: '5107144028',
        city: 'Chicago',
        level: 'Intermediate',
      },
    ],
    seed: 3,
  },
  {
    participants: [
      {
        name: 'Suma Sri',
        email: 'keyagandhi251994@gmail.com',
        phone: '7344318165',
        city: 'Peoria',
        level: 'Intermediate',
      },
      {
        name: 'Keya Gandhi',
        email: 'keyagandhi251994@gmail.com',
        phone: '7344318165',
        city: 'Peoria',
        level: 'Intermediate',
      },
    ],
    seed: 4,
  },
  {
    participants: [
      {
        name: 'Levanshia Anthonysamy',
        email: 'levanshia@gmail.com',
        phone: '3092054306',
        city: 'Normal',
        level: 'Intermediate',
      },
      {
        name: 'Bhavana Sivakumar',
        email: 'bhavana.sivakumar@gmail.com',
        phone: '6782166452',
        city: 'Bloomington',
        level: 'Intermediate',
      },
    ],
    seed: 5,
  },
  {
    participants: [
      {
        name: 'Kirthika Chockalingam',
        email: 'kirthika02@gmail.com',
        phone: '(309) 533-5398',
        city: 'Bloomington',
        level: 'Intermediate',
      },
      {
        name: 'Akshaya Ramamoorthi',
        email: 'akshayanov92@gmail.com',
        phone: '3095326406',
        city: 'Bloomington',
        level: 'Intermediate',
      },
    ],
    seed: 6,
  },
  {
    participants: [
      {
        name: 'Ritika Panthula',
        email: 'ritika.panthula@gmail.com',
        phone: '(630) 768-8696',
        city: 'Bloomington',
        level: 'Beginner',
      },
      {
        name: 'Deepthi Rajagopal',
        email: 'Deepthirajagopal92@gmail.com',
        phone: '+1 (414) 595-5626',
        city: 'Bloomington',
        level: 'Beginner',
      },
    ],
    seed: 7,
  },
  {
    participants: [
      {
        name: 'Mohana Anandhan',
        email: 'monaa1384@gmail.com',
        phone: '3093100227',
        city: 'Bloomington',
        level: 'Beginner',
      },
      {
        name: 'Anitha Rajendran',
        email: 'monaa1384@gmail.com',
        phone: '+1 (309) 531-1987',
        city: 'Bloomington',
        level: 'Beginner',
      },
    ],
    seed: 8,
  },
  {
    participants: [
      {
        name: 'Aruna Ravichandran',
        email: 'arunamanikandan26@gmail.com',
        phone: '(309) 826-8447',
        city: 'BLOOMINGTON',
        level: 'Beginner',
      },
      {
        name: 'Shiwangee Samant',
        email: 'samant.shiwangee@gmail.com',
        phone: '+1 (309) 531-5749',
        city: 'Normal',
        level: 'Beginner',
      },
    ],
    seed: 9,
  },
  {
    participants: [
      {
        name: 'Jaishree Arun',
        email: 'ja.shree14@gmail.com',
        phone: '(309) 533-1118',
        city: 'Bloomington',
        level: 'Beginner',
      },
      {
        name: 'Devi Shakthi',
        email: 'devikv.devi@gmail.com',
        phone: '3092054252',
        city: 'Bloomington',
        level: 'Beginner',
      },
    ],
    seed: 10,
  },
  {
    participants: [
      {
        name: 'Lakshmi Balakrishnan',
        email: 'lakshmijawaharbabu@gmail.com',
        phone: '(309) 706-9737',
        city: 'bloomington',
        level: 'Beginner',
      },
      {
        name: 'Alaghu shree Ganaesh latha',
        email: 'shreeganaesh@gmail.com',
        phone: '2092215036',
        city: 'Bloomington',
        level: 'Beginner',
      },
    ],
    seed: 11,
  },
  {
    participants: [
      {
        name: 'Lakshmi Priya Velraj',
        email: 'lakshmipriyavlp94@gmail.com',
        phone: '(309) 533-6907',
        city: 'Bloomington',
        level: 'Beginner',
      },
      {
        name: 'Lavanya Shanmugam',
        email: 'lav.shan11@gmail.com',
        phone: '3095333674',
        city: 'Bloomington',
        level: 'Beginner',
      },
    ],
    seed: 12,
  },
  {
    participants: [
      {
        name: 'Indu Kishore',
        email: 'kishoreraosubbarao@gmail.com',
        phone: '(309) 531-8717',
        city: 'Bloomington',
        level: 'Beginner',
      },
      {
        name: 'Vinodhini Nirmal',
        email: 'kishireraosubbarao@gmail.com',
        phone: '3095318717',
        city: 'Bloomington',
        level: 'Beginner',
      },
    ],
    seed: 13,
  },
  {
    participants: [
      {
        name: 'Pallavi Patel',
        email: 'ravi365@hotmail.com',
        phone: '(309) 706-6215',
        city: 'Bloomington',
        level: 'Beginner',
      },
      {
        name: 'Saheli Sheth',
        email: 'sahelisheth@gmail.com',
        phone: '3093408411',
        city: 'Bloomington',
        level: 'Beginner',
      },
    ],
    seed: 14,
  },
  {
    participants: [
      {
        name: 'Ramya Sengottaiyan',
        email: 'ramyasengottaiyan18@gmail.com',
        phone: '(309) 665-1686',
        city: 'Bloomington',
        level: 'Beginner',
      },
      {
        name: 'Kripa Nagarajan',
        email: 'kripaprem.usa@gmail.com',
        phone: '3096651629',
        city: 'Bloomington',
        level: 'Beginner',
      },
    ],
    seed: 15,
  },
] as const;

const TNF_2026_MENS_DOUBLES_CORRECTIONS: ReadonlyArray<{
  participants: [RawParticipant, RawParticipant];
  seed: number;
}> = [
  {
    participants: [
      { name: 'Kavin KK', email: 'kavin29psg@gmail.com', phone: '(405) 612-5600', city: 'Bloomington', level: 'Advanced' },
      { name: 'Pritesh Pitti', email: 'Prit_14@yahoo.com', phone: '+1 (217) 721-0041', city: 'Bloomington', level: 'Advanced' },
    ],
    seed: 1,
  },
  {
    participants: [
      { name: 'Dhrumil Trivedi', email: 'dhrumil.trivedi94@gmail.com', phone: '(734) 419-3049', city: 'Peoria', level: 'Advanced' },
      { name: 'Sudhan Sekar', email: 'karthisudhan88@gmail.com', phone: '3095506409', city: 'Peoria', level: 'Advanced' },
    ],
    seed: 2,
  },
  {
    participants: [
      { name: 'Tejas Mayavanshi', email: 'tejas_maya@hotmail.com', phone: '(312) 914-1999', city: 'Normal', level: 'Intermediate' },
      { name: 'Divaspathi Bhat', email: 'Divibhat@gmail.com', phone: '(309) 863-7823', city: 'Normal', level: 'Intermediate' },
    ],
    seed: 3,
  },
  {
    participants: [
      { name: 'Ramkumar Vaithilingam', email: 'raam.v@yahoo.com', phone: '(786) 686-5672', city: 'Bloomington', level: 'Advanced' },
      { name: 'Sakthinesan Somanathan', email: 'Sakthi88nesan@gmail.com', phone: '7866065672', city: 'Bloomington', level: 'Advanced' },
    ],
    seed: 4,
  },
  {
    participants: [
      { name: 'Himesh Reddivari', email: 'himesh1729@gmail.com', phone: '(309) 361-9723', city: 'Peoria', level: 'Beginner' },
      { name: 'Arjun C', email: 'Arjunvuppu@gmail.com', phone: '3523272095', city: 'Peoria', level: 'Beginner' },
    ],
    seed: 5,
  },
  {
    participants: [
      { name: 'Hithesh Reddivari', email: 'hitheshaum@gmail.com', phone: '(213) 822-2809', city: 'Peoria', level: 'Advanced' },
      { name: 'Prakash P', email: 'mukkuprakash238@gmail.com', phone: '(475) 287-3772', city: 'Peoria', level: 'Advanced' },
    ],
    seed: 6,
  },
  {
    participants: [
      { name: 'Christuraj Arockiasamy', email: 'mr.christuraj@gmail.com', phone: '2486134977', city: 'Normal', level: 'Intermediate' },
      { name: 'Abhiram Madugula', email: 'abhirammadugula@gmail.com', phone: '6692089785', city: 'Bloomington', level: 'Intermediate' },
    ],
    seed: 7,
  },
  {
    participants: [
      { name: 'Gowtham Kandasamy', email: 'gowthamptr@gmail.com', phone: '(346) 218-9637', city: 'Bloomington', level: 'Intermediate' },
      { name: 'Arjun Ponnapati', email: 'Arjunponnapati@gmail.com', phone: '7135947679', city: 'Bloomington', level: 'Intermediate' },
    ],
    seed: 8,
  },
  {
    participants: [
      { name: 'Sri Tummala', email: 'vasu.0145@gmail.com', phone: '(248) 885-9026', city: 'Bloomington', level: 'Intermediate' },
      { name: 'Raja Kakani', email: 'kakani.rajashekhar@gmail.com', phone: '(732) 357-5966', city: 'Bloomington', level: 'Intermediate' },
    ],
    seed: 9,
  },
  {
    participants: [
      { name: 'Karthikeyan Subramanian', email: 'karthe.smk@gmail.com', phone: '(309) 826-6324', city: 'Normal', level: 'Beginner' },
      { name: 'Vinothkumar Nagarajan', email: 'gn.vinoth@gmail.com', phone: '3097509818', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 10,
  },
  {
    participants: [
      { name: 'Anand Seenivasan', email: 'anand.renganath.s@gmail.com', phone: '(309) 391-3063', city: 'Bloomington', level: 'Intermediate' },
      { name: 'Hemchandran Manivannan', email: 'hemchandran@yahoo.com', phone: '3093913050', city: 'Bloomington', level: 'Intermediate' },
    ],
    seed: 11,
  },
  {
    participants: [
      { name: 'Sriraman Balakrishnan', email: 'bsriramanb@gmail.com', phone: '(309) 307-9274', city: 'Bloomington', level: 'Intermediate' },
      { name: 'Kumaran Thirunavukarasu', email: 'kumar.thirunavukarasu1@gmail.com', phone: '3095315600', city: 'Bloomington', level: 'Intermediate' },
    ],
    seed: 12,
  },
  {
    participants: [
      { name: 'Chiranjivi Aulakh', email: 'cajv2025@gmail.com', phone: '(619) 552-5356', city: 'Bloomington', level: 'Intermediate' },
      { name: 'Ajith Ramesan', email: 'Ajith.ramesan86@gmail.com', phone: '3095329501', city: 'Bloomington', level: 'Intermediate' },
    ],
    seed: 13,
  },
  {
    participants: [
      { name: 'Arun Jay', email: 'mail2arun.cbe@gmail.com', phone: '(309) 531-6798', city: 'Bloomington', level: 'Intermediate' },
      { name: 'Rajkumar Murugan', email: 'mrajuit@gmail.com', phone: '13096609338', city: 'Bloomington', level: 'Intermediate' },
    ],
    seed: 14,
  },
  {
    participants: [
      { name: 'Manoj Edward', email: 'manojedward.btech@gmail.com', phone: '3095308920', city: 'Bloomington', level: 'Beginner' },
      { name: 'Karthik Kalairajan', email: 'manojedward.btech@gmail.com', phone: '+1 (309) 391-3051', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 15,
  },
  {
    participants: [
      { name: 'Rohith Kariveda', email: 'rohith.myway@gmail.com', phone: '(872) 202-9449', city: 'Bloomington', level: 'Intermediate' },
      { name: 'Venkatesh Prabhu', email: 'rohith.myway@gmail.com', phone: '+1 (872) 305-3127', city: 'Bloomington', level: 'Intermediate' },
    ],
    seed: 16,
  },
  {
    participants: [
      { name: 'Kishore Subbarao', email: 'kishoreraosubbarao@gmail.com', phone: '(309) 531-8717', city: 'Bloomington', level: 'Intermediate' },
      { name: 'Ramchand Venkatasamy', email: 'ramchand4685@gmail.com', phone: '2488859243', city: 'Bloomington', level: 'Intermediate' },
    ],
    seed: 17,
  },
  {
    participants: [
      { name: 'Vinay Patnaik', email: 'vinaypatnaik193@gmail.com', phone: '(309) 612-6225', city: 'Bloomington', level: 'Beginner' },
      { name: 'Prem Madiraju', email: 'Premkumarsudha@gmail.com', phone: '(715) 907-5888', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 18,
  },
  {
    participants: [
      { name: 'Dinesh Krishnan', email: 'dinesh.org@gmail.com', phone: '(309) 310-0274', city: 'Bloomington', level: 'Beginner' },
      { name: 'Siva Sankar', email: 'dinesh.org@gmail.com', phone: '3095327587', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 19,
  },
  {
    participants: [
      { name: 'Surendar Sekar', email: 'surenoriginals@gmail.com', phone: '(309) 533-5129', city: 'Normal', level: 'Intermediate' },
      { name: 'Ayaskant Rout', email: 'ayaskant.rout@gmail.com', phone: '(309) 533-5949', city: 'Normal', level: 'Intermediate' },
    ],
    seed: 20,
  },
  {
    participants: [
      { name: 'Nirmalraj Anandan', email: 'nirmal16a@gmail.com', phone: '(309) 531-5537', city: 'Bloomington', level: 'Beginner' },
      { name: 'Krishna Balakrishnan', email: 'krishna@parkeregency.com', phone: '2487033410', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 21,
  },
  {
    participants: [
      { name: 'Sivakumar Srinivasulu', email: 'itsme.sivak@gmail.com', phone: '(309) 306-1415', city: 'Bloomington', level: 'Beginner' },
      { name: 'Vijay Sivakumar Moorthy', email: 'vjshiv86@gmail.com', phone: '3095310893', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 22,
  },
  {
    participants: [
      { name: 'Srikanth Marikkannu', email: 'srimarikk@gmail.com', phone: '(309) 660-2532', city: 'Bloomington', level: 'Beginner' },
      { name: 'Mathibal Balasubramanian', email: 'mathibal.b@gmail.com', phone: '3095331506', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 23,
  },
  {
    participants: [
      { name: 'Ravi Bhushan Mishra', email: 'ravibhushan.mishra@gmail.com', phone: '(309) 439-8368', city: 'Dunlap', level: 'Intermediate' },
      { name: 'Adinarayana Botlagunta', email: 'aadhi402@gmail.com', phone: '(309) 314-6632', city: 'Dunlap', level: 'Intermediate' },
    ],
    seed: 24,
  },
  {
    participants: [
      { name: 'Jawaharbabu Jeyaraman', email: 'jawaharbabuj@gmail.com', phone: '(309) 825-4798', city: 'Bloomington', level: 'Intermediate' },
      { name: 'Saikumar Ruttala', email: 'jawaharbabuj@gmail.com', phone: '3098254798', city: 'Bloomington', level: 'Intermediate' },
    ],
    seed: 25,
  },
  {
    participants: [
      { name: 'Vishu Sadu', email: 'vishwanthsadu08@gmail.com', phone: '(312) 273-8301', city: 'Chicago', level: 'Intermediate' },
      { name: 'Harshavardhan Modugu', email: 'hmodug2@uic.edu', phone: '+1 (223) 758-0764', city: 'Chicago', level: 'Intermediate' },
    ],
    seed: 26,
  },
  {
    participants: [
      { name: 'Vijay Nalamothu', email: 'Vijaynalamothu1@gmail.com', phone: '(309) 989-9457', city: 'Peoria', level: 'Intermediate' },
      { name: 'Sai Suchith Pesala', email: 'ssuchith26@gmail.com', phone: '(240) 886-4798', city: 'Peoria', level: 'Intermediate' },
    ],
    seed: 27,
  },
  {
    participants: [
      { name: 'Ravi Patel', email: 'ravi365@hotmail.com', phone: '(309) 706-6215', city: 'Bloomington', level: 'Intermediate' },
      { name: 'Puneet Dubey', email: 'puneetdubey1@gmail.com', phone: '3098462675', city: 'Bloomington', level: 'Intermediate' },
    ],
    seed: 28,
  },
  {
    participants: [
      { name: 'Shakthi Rajendran', email: 'swa11sha@gmail.com', phone: '(703) 479-1758', city: 'Normal', level: 'Beginner' },
      { name: 'Arun Karthik', email: 'shreeganaesh@gmail.com', phone: '2092215036', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 29,
  },
  {
    participants: [
      { name: 'Aakash Paranjape', email: 'aakash0589@gmail.com', phone: '(309) 824-9961', city: 'Bloomington', level: 'Beginner' },
      { name: 'Apurva Paranjape', email: 'apurvacbl@gmail.com', phone: '3098266555', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 30,
  },
  {
    participants: [
      { name: 'Harish Sekar', email: 'hxsekar@gmail.com', phone: '(872) 215-6474', city: 'Bloomington', level: 'Beginner' },
      { name: 'Vinoth Rajendran', email: 'vinoth2002@gmail.com', phone: '+1 (309) 531-3312', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 31,
  },
  {
    participants: [
      { name: 'Sahaya Vinodh Thomas Benzie', email: 'sahayavinodh@gmail.com', phone: '(309) 807-7373', city: 'Bloomington', level: 'Beginner' },
      { name: 'Uday Sankar', email: 'udayasankar99@gmail.com', phone: '3096123020', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 32,
  },
  {
    participants: [
      { name: 'Suresh Neelam', email: 'sureshneelu229@gmail.com', phone: '(484) 358-2552', city: 'Peoria', level: 'Beginner' },
      { name: 'Pavan Rajulapati', email: 'ps3293.in@gmail.com', phone: '9133267215', city: 'Peoria', level: 'Beginner' },
    ],
    seed: 33,
  },
  {
    participants: [
      { name: 'Saran Maharajan', email: 'saran.7176@gmail.com', phone: '3093070358', city: 'Normal', level: 'Beginner' },
      { name: 'Ramesh Ramachandran', email: 'rameshramachandran3@gmail.com', phone: '3093072915', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 34,
  },
  {
    participants: [
      { name: 'Vishnuvardhan Venkannagari', email: 'vishnureddy251998@gmail.com', phone: '(309) 222-0106', city: 'Peoria', level: 'Beginner' },
      { name: 'RLK Bharadwaj', email: 'rlkbharath@gmail.com', phone: '3098921070', city: 'Peoria', level: 'Beginner' },
    ],
    seed: 35,
  },
  {
    participants: [
      { name: 'Snehith Katkuri', email: 'snehithreddy022@gmail.com', phone: '(312) 358-2970', city: 'Peoria', level: 'Beginner' },
      { name: 'Nuthan Sai Mylarapu', email: 'eeshwarnuthan2364@gmail.com', phone: '4254420049', city: 'Peoria', level: 'Beginner' },
    ],
    seed: 36,
  },
  {
    participants: [
      { name: 'Satish Rambha', email: 'satish.rambha@gmail.com', phone: '(908) 423-9210', city: 'Bloomington', level: 'Beginner' },
      { name: 'Bhargava Charugundla', email: 'Bhargava.charugundla@gmail.com', phone: '2708903830', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 37,
  },
  {
    participants: [
      { name: 'Sudheer Kumar K V', email: 'kvsk07@outlook.com', phone: '(945) 289-0381', city: 'Bloomington', level: 'Beginner' },
      { name: 'Mahesh K', email: 'Mahesh.kandula34@gmail.com', phone: '5713635113', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 38,
  },
  {
    participants: [
      { name: 'Ayyanar Chinnaraj', email: 'cayyanar@yahoo.co.in', phone: '(913) 244-1885', city: 'Bloomington', level: 'Beginner' },
      { name: 'Anand Chokkiah', email: 'anandc272@gmail.com', phone: '30093073141', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 39,
  },
] as const;

// Mixed Doubles: participants[0] = male, participants[1] = female (matches playerGenderForCategory).
// Rows where the female was listed first in the source data have been swapped here.
const TNF_2026_MIXED_DOUBLES_CORRECTIONS: ReadonlyArray<{
  participants: [RawParticipant, RawParticipant];
  seed: number;
}> = [
  {
    // Sudhan (m)[0] + Ritchel Salvador (f)[1] — shared email; resolveSeedEmail will discriminate
    participants: [
      { name: 'Sudhan Sekar', email: 'karthisudhan88@gmail.com', phone: '(309) 550-6409', city: 'Peoria', level: 'Intermediate' },
      { name: 'Ritchel Salvador', email: 'karthisudhan88@gmail.com', phone: '3095506409', city: 'Peoria', level: 'Intermediate' },
    ],
    seed: 1,
  },
  {
    // Swapped from source (Donna was listed first): Abhiram (m)[0] + Donna (f)[1]
    participants: [
      { name: 'Abhiram Madugula', email: 'ABHIRAMMADUGULA93@GMAIL.COM', phone: '(669) 208-9785', city: 'Bloomington', level: 'Intermediate' },
      { name: 'Donna Shippy', email: 'shippydms@gmail.com', phone: '(309) 242-2522', city: 'Peoria', level: 'Intermediate' },
    ],
    seed: 2,
  },
  {
    participants: [
      { name: 'Dhrumil Trivedi', email: 'dhrumil.trivedi94@gmail.com', phone: '(734) 419-3049', city: 'Peoria', level: 'Advanced' },
      { name: 'Keya Gandhi', email: 'keyagandhi251994@gmail.com', phone: '7344318165', city: 'Peoria', level: 'Beginner' },
    ],
    seed: 3,
  },
  {
    participants: [
      { name: 'Christuraj Arockiasamy', email: 'mr.christuraj@gmail.com', phone: '2486134977', city: 'Normal', level: 'Intermediate' },
      { name: 'Levanshia Anthonysamy', email: 'levanshia@gmail.com', phone: '3092054306', city: 'Normal', level: 'Intermediate' },
    ],
    seed: 4,
  },
  {
    participants: [
      { name: 'Gowtham Kandasamy', email: 'gowthamptr@gmail.com', phone: '(346) 218-9637', city: 'Bloomington', level: 'Beginner' },
      { name: 'Deepthi Rajagopal', email: 'deepthi.nift@gmail.con', phone: '4145955626', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 5,
  },
  {
    // Swapped from source (Ritika was listed first): Mahesh (m)[0] + Ritika (f)[1]
    participants: [
      { name: 'Mahesh Kandula', email: 'Mahesh.kandula34@gmail.com', phone: 'Mahesh Badminton', city: 'Bloomington', level: 'Intermediate' },
      { name: 'Ritika Panthula', email: 'ritika.panthula@gmail.com', phone: '(630) 768-8696', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 6,
  },
  {
    // Swapped from source (Nikhitha was listed first): Naresh (m)[0] + Nikhitha (f)[1]
    // Shared email; resolveSeedEmail will discriminate
    participants: [
      { name: 'Naresh Jasti', email: 'nikithanelakuditi@gmail.com', phone: '2177619681', city: "O'Fallon", level: 'Intermediate' },
      { name: 'Nikhitha Nelakuditi', email: 'nikithanelakuditi@gmail.com', phone: '(217) 761-9681', city: "O'Fallon", level: 'Intermediate' },
    ],
    seed: 7,
  },
  {
    participants: [
      { name: 'Himesh Reddivari', email: 'himesh1729@gmail.com', phone: '(309) 361-9723', city: 'Peoria', level: 'Beginner' },
      { name: 'Bhavana Chadive', email: 'bhavana.sivakumar@gmail.com', phone: '6782166452', city: 'Peoria', level: 'Beginner' },
    ],
    seed: 8,
  },
  {
    participants: [
      { name: 'Amit Vyas', email: 'amitrvyasmd@gmail.com', phone: '2488940367', city: 'Normal', level: 'Beginner' },
      { name: 'Smita Vyas', email: 'vyassmita.79@gmail.com', phone: '2488754473', city: 'Normal', level: 'Beginner' },
    ],
    seed: 9,
  },
  {
    participants: [
      { name: 'Arun Jay', email: 'mail2arun.cbe@gmail.com', phone: '(309) 531-6798', city: 'Bloomington', level: 'Intermediate' },
      { name: 'Jai Arun', email: 'ja.shree14@gmail.com', phone: '3095331118', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 10,
  },
  {
    // Swapped from source (Sneha was listed first): Venkatesh (m)[0] + Sneha (f)[1]
    participants: [
      { name: 'Venkatesh Prabhu Krishnasamy', email: 'venkateshk.91@gmail.com', phone: '8723053127', city: 'Bloomington', level: 'Beginner' },
      { name: 'Sneha Sreedevi', email: 'snehavijayan8121@gmail.com', phone: '(945) 233-7663', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 11,
  },
  {
    // Swapped from source (Devi Kumar was listed first): Arunkarthik (m)[0] + Devi Kumar (f)[1]
    participants: [
      { name: 'Arunkarthik Rajendran', email: 'rarunkarthikr@gmail.com', phone: '3136039113', city: 'Bloomington', level: 'Beginner' },
      { name: 'Devi Kumar', email: 'devikv.devi@gmail.com', phone: '(309) 205-4252', city: 'Normal', level: 'Beginner' },
    ],
    seed: 12,
  },
  {
    participants: [
      { name: 'Shakthi Rajendran', email: 'swa11sha@gmail.com', phone: '(703) 479-1758', city: 'Normal', level: 'Beginner' },
      { name: 'Arunkarthik Rajendran', email: 'rarunkarthikr@gmail.com', phone: '3136039113', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 13,
  },
  {
    // Shared email; resolveSeedEmail will discriminate
    participants: [
      { name: 'Jawaharbabu Jeyaraman', email: 'jawaharbabuj@gmail.com', phone: '(309) 825-4798', city: 'Bloomington', level: 'Intermediate' },
      { name: 'Lakshmi Balakrishnan', email: 'jawaharbabuj@gmail.com', phone: '3098254798', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 14,
  },
  {
    participants: [
      { name: 'Nirmalraj Ananda', email: 'nirmal16a@gmail.com', phone: '(309) 531-5537', city: 'Bloomington', level: 'Beginner' },
      { name: 'Vinothini Nirmalraj', email: 'vinoumapathy@gmail.com', phone: '3096607299', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 15,
  },
  {
    // Shared email; resolveSeedEmail will discriminate
    participants: [
      { name: 'Sunil Nair', email: 'snair1422@gmail.com', phone: '(309) 533-6840', city: 'Bloomington', level: 'Beginner' },
      { name: 'Priyanka Nair', email: 'snair1422@gmail.com', phone: '3095311377', city: 'Bloomington', level: 'Beginner' },
    ],
    seed: 16,
  },
] as const;

const CATEGORY_CONFIGS: readonly CategorySeedConfig[] = [
  {
    key: 'MS',
    name: "Men's Singles",
    type: 'singles',
    gender: 'men',
    selectColumn: 4,
    dataStartColumn: 10,
  },
  {
    key: 'MD',
    name: "Men's Doubles",
    type: 'doubles',
    gender: 'men',
    selectColumn: 5,
    dataStartColumn: 15,
  },
  {
    key: 'WD',
    name: "Women's Doubles",
    type: 'doubles',
    gender: 'women',
    selectColumn: 6,
    dataStartColumn: 25,
  },
  {
    key: 'MXD',
    name: 'Mixed Doubles',
    type: 'mixed_doubles',
    gender: 'mixed',
    selectColumn: 7,
    dataStartColumn: 35,
  },
  {
    key: 'YD',
    name: 'Youth Doubles',
    type: 'doubles',
    gender: 'open',
    selectColumn: 8,
    dataStartColumn: 45,
  },
  {
    key: 'KD',
    name: 'Kids Doubles',
    type: 'doubles',
    gender: 'open',
    selectColumn: 9,
    dataStartColumn: 55,
  },
] as const;

const cleanCell = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim();

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/(^\.)|(\.$)/g, '')
    .replace(/\.+/g, '.');

const simpleHash = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
};

const toSkillLevel = (level: string): number => {
  const normalized = level.toLowerCase();
  if (normalized.includes('advanced')) return 8;
  if (normalized.includes('intermediate')) return 5;
  return 1;
};

const hasSelection = (row: unknown[], column: number): boolean => cleanCell(row[column]) !== '';

const readParticipant = (row: unknown[], startColumn: number): RawParticipant => ({
  name: cleanCell(row[startColumn]),
  email: cleanCell(row[startColumn + 1]),
  phone: cleanCell(row[startColumn + 2]),
  city: cleanCell(row[startColumn + 3]),
  level: cleanCell(row[startColumn + 4]),
});

const participantIdentityKey = (participant: SeedParticipant): string =>
  participant.seedEmail.toLowerCase();

const registrationIdentityKey = (registration: ParsedRegistration): string => {
  if (registration.participants.length === 1) {
    return `${registration.categoryKey}|${participantIdentityKey(registration.participants[0])}`;
  }

  const teamKey = registration.participants
    .map(participantIdentityKey)
    .sort()
    .join('|');

  return `${registration.categoryKey}|${teamKey}`;
};

const resolveSeedEmail = (
  participant: RawParticipant,
  emailNameMap: Map<string, Set<string>>,
): string => {
  const normalizedEmail = participant.email.toLowerCase();
  const normalizedName = participant.name.toLowerCase();
  const namesForEmail = normalizedEmail ? emailNameMap.get(normalizedEmail) : null;

  if (
    normalizedEmail &&
    namesForEmail &&
    namesForEmail.size === 1
  ) {
    return normalizedEmail;
  }

  const slug = slugify(participant.name || 'player');
  const discriminatorSource = normalizedEmail || participant.phone || participant.city || participant.level || 'seed';
  const discriminator = simpleHash(`${normalizedName}|${discriminatorSource.toLowerCase()}`);

  return `${slug}.${discriminator}@import.courtmastr.local`;
};

const buildAuthoritativeWomenDoublesRegistrations = (): RawRegistration[] =>
  TNF_2026_WOMENS_DOUBLES_CORRECTIONS.map((entry) => ({
    categoryKey: 'WD',
    participants: [...entry.participants],
    entryId: `wd-manual-${entry.seed}`,
    seed: entry.seed,
  }));

const buildAuthoritativeMensDoublesRegistrations = (): RawRegistration[] =>
  TNF_2026_MENS_DOUBLES_CORRECTIONS.map((entry) => ({
    categoryKey: 'MD',
    participants: [...entry.participants],
    entryId: `md-manual-${entry.seed}`,
    seed: entry.seed,
  }));

const buildAuthoritativeMixedDoublesRegistrations = (): RawRegistration[] =>
  TNF_2026_MIXED_DOUBLES_CORRECTIONS.map((entry) => ({
    categoryKey: 'MXD',
    participants: [...entry.participants],
    entryId: `mxd-manual-${entry.seed}`,
    seed: entry.seed,
  }));

const extractRawRegistrations = (rows: unknown[][]): RawRegistration[] => {
  const registrations: RawRegistration[] = [];

  for (const row of rows) {
    const entryId = cleanCell(row[73]);

    if (hasSelection(row, 4)) {
      const singlesPrimary = readParticipant(row, 10);
      const singlesFallback = readParticipant(row, 15);
      const singlesParticipant = singlesPrimary.name ? singlesPrimary : singlesFallback;

      if (singlesParticipant.name) {
        registrations.push({
          categoryKey: 'MS',
          participants: [singlesParticipant],
          entryId,
          seed: null,
        });
      }
    }

    for (const config of CATEGORY_CONFIGS) {
      if (config.key === 'MS' || !hasSelection(row, config.selectColumn)) {
        continue;
      }

      const playerOne = readParticipant(row, config.dataStartColumn);
      const playerTwo = readParticipant(row, config.dataStartColumn + 5);

      if (!playerOne.name || !playerTwo.name) {
        continue;
      }

      registrations.push({
        categoryKey: config.key,
        participants: [playerOne, playerTwo],
        entryId,
        seed: null,
      });
    }
  }

  return registrations;
};

export const parseTNF2026Workbook = (workbookPath: string): {
  registrations: ParsedRegistration[];
  duplicatesDropped: number;
} => {
  const workbook = XLSX.readFile(workbookPath);
  const [sheetName] = workbook.SheetNames;
  if (!sheetName) {
    throw new Error('Workbook does not contain any sheets');
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    blankrows: false,
    defval: '',
  }) as unknown[][];

  const workbookRegistrations = extractRawRegistrations(rows.slice(1));
  const rawRegistrations = [
    ...workbookRegistrations.filter(
      (registration) =>
        registration.categoryKey !== 'WD' &&
        registration.categoryKey !== 'MD' &&
        registration.categoryKey !== 'MXD',
    ),
    ...buildAuthoritativeWomenDoublesRegistrations(),
    ...buildAuthoritativeMensDoublesRegistrations(),
    ...buildAuthoritativeMixedDoublesRegistrations(),
  ];
  const emailNameMap = new Map<string, Set<string>>();

  for (const registration of rawRegistrations) {
    for (const participant of registration.participants) {
      const normalizedEmail = participant.email.toLowerCase();
      if (!normalizedEmail) {
        continue;
      }

      const knownNames = emailNameMap.get(normalizedEmail) ?? new Set<string>();
      knownNames.add(participant.name.toLowerCase());
      emailNameMap.set(normalizedEmail, knownNames);
    }
  }

  const deduped = new Map<string, ParsedRegistration>();

  for (const registration of rawRegistrations) {
    const participants = registration.participants.map((participant) => ({
      ...participant,
      seedEmail: resolveSeedEmail(participant, emailNameMap),
    }));
    const parsedRegistration: ParsedRegistration = {
      categoryKey: registration.categoryKey,
      participants,
      entryId: registration.entryId,
      seed: registration.seed,
    };
    const key = registrationIdentityKey(parsedRegistration);

    if (!deduped.has(key)) {
      deduped.set(key, parsedRegistration);
    }
  }

  return {
    registrations: [...deduped.values()],
    duplicatesDropped: rawRegistrations.length - deduped.size,
  };
};

const playerGenderForCategory = (
  categoryKey: string,
  participantIndex: number,
): PlayerGender => {
  if (categoryKey === 'WD') {
    return 'female';
  }

  if (categoryKey === 'MXD') {
    return participantIndex === 0 ? 'male' : 'female';
  }

  return 'male';
};

const findCategoryByKey = (
  categorySnapshots: Array<{ id: string; name: string }>,
  categoryKey: string,
): CategoryInfo => {
  const configEntry = CATEGORY_CONFIGS.find((entry) => entry.key === categoryKey);
  if (!configEntry) {
    throw new Error(`Unknown category key: ${categoryKey}`);
  }

  const category = categorySnapshots.find((entry) => entry.name === configEntry.name);
  if (!category) {
    throw new Error(`Missing category mapping for ${categoryKey}`);
  }

  return {
    id: category.id,
    key: categoryKey,
    name: configEntry.name,
  };
};

const createPlayerResolver = (
  db: Firestore,
  tournamentId: string,
): ((participant: SeedParticipant, gender: PlayerGender) => Promise<string>) => {
  const playerIdCache = new Map<string, string>();
  const emailIdCache = new Map<string, string>();

  return async (
    participant: SeedParticipant,
    gender: PlayerGender,
  ): Promise<string> => {
    const cacheKey = participant.seedEmail.toLowerCase();
    const cached = playerIdCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const nameParts = participant.name.split(' ').filter(Boolean);
    const firstName = nameParts.shift() ?? participant.name;
    const lastName = nameParts.join(' ') || '-';
    const globalPlayerId = await seedGlobalPlayer(
      db,
      tournamentId,
      {
        firstName,
        lastName,
        email: participant.seedEmail,
        phone: participant.phone || '555-0000',
        gender,
        skillLevel: toSkillLevel(participant.level),
      },
      emailIdCache,
    );

    playerIdCache.set(cacheKey, globalPlayerId);
    return globalPlayerId;
  };
};

const writeRegistration = async (
  db: Firestore,
  tournamentId: string,
  category: CategoryInfo,
  registration: ParsedRegistration,
  adminId: string,
  getOrCreatePlayer: (participant: SeedParticipant, gender: PlayerGender) => Promise<string>,
  existingRegistrationId?: string,
): Promise<void> => {
  const playerOneId = await getOrCreatePlayer(
    registration.participants[0],
    playerGenderForCategory(registration.categoryKey, 0),
  );

  const registrationPayload = {
    tournamentId,
    categoryId: category.id,
    status: 'approved',
    isCheckedIn: false,
    paymentStatus: 'paid',
    registeredBy: adminId,
    registeredAt: serverTimestamp(),
    approvedAt: serverTimestamp(),
    approvedBy: adminId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    seed: registration.seed,
  };

  if (registration.participants.length === 1) {
    const payload = {
      ...registrationPayload,
      participantType: 'player',
      playerId: playerOneId,
    };

    if (existingRegistrationId) {
      await setDoc(
        doc(db, 'tournaments', tournamentId, 'registrations', existingRegistrationId),
        payload,
        { merge: true },
      );
      return;
    }

    await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), payload);
    return;
  }

  const playerTwoId = await getOrCreatePlayer(
    registration.participants[1],
    playerGenderForCategory(registration.categoryKey, 1),
  );
  const teamName = `${registration.participants[0].name} / ${registration.participants[1].name}`;
  const payload = {
    ...registrationPayload,
    participantType: 'team',
    playerId: playerOneId,
    partnerPlayerId: playerTwoId,
    teamName,
  };

  if (existingRegistrationId) {
    await setDoc(
      doc(db, 'tournaments', tournamentId, 'registrations', existingRegistrationId),
      payload,
      { merge: true },
    );
    return;
  }

  await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), payload);
};

const clearCategoryBracketData = async (
  db: Firestore,
  tournamentId: string,
  categoryId: string,
): Promise<void> => {
  const subcollections = ['stage', 'participant', 'match', 'match_scores'];
  let deletedTotal = 0;

  for (const sub of subcollections) {
    const snap = await getDocs(
      collection(db, 'tournaments', tournamentId, 'categories', categoryId, sub),
    );
    for (const docSnap of snap.docs) {
      await deleteDoc(docSnap.ref);
      deletedTotal++;
    }
  }

  await updateDoc(doc(db, 'tournaments', tournamentId, 'categories', categoryId), {
    status: 'registration',
    updatedAt: serverTimestamp(),
  });

  console.log(`  [force] Cleared ${deletedTotal} bracket docs, reset category status to 'registration'`);
};

export const repairExistingWomenDoublesRegistrations = async (
  db: Firestore,
  tournamentId: string,
  adminId: string,
  force = false,
): Promise<void> => {
  // Build authoritative WD ParsedRegistrations directly from corrections constant.
  // All WD teams carry real emails, so seedEmail is the normalised email.
  const wdRegistrations: ParsedRegistration[] = buildAuthoritativeWomenDoublesRegistrations().map(
    (raw) => ({
      ...raw,
      participants: raw.participants.map((p) => ({
        ...p,
        seedEmail: p.email.toLowerCase(),
      })),
    }),
  );

  const categorySnapshots = await getDocs(collection(db, 'tournaments', tournamentId, 'categories'));
  const womenDoublesCategory = findCategoryByKey(
    categorySnapshots.docs.map((snapshot) => ({
      id: snapshot.id,
      name: String(snapshot.data().name ?? ''),
    })),
    'WD',
  );
  const womenDoublesCategoryDoc = categorySnapshots.docs.find(
    (snapshot) => snapshot.id === womenDoublesCategory.id,
  );
  const stageSnapshot = await getDocs(
    collection(db, 'tournaments', tournamentId, 'categories', womenDoublesCategory.id, 'stage'),
  );
  const participantSnapshot = await getDocs(
    collection(db, 'tournaments', tournamentId, 'categories', womenDoublesCategory.id, 'participant'),
  );

  if (!womenDoublesCategoryDoc) {
    throw new Error(`Missing Women's Doubles category document for tournament ${tournamentId}`);
  }

  if (stageSnapshot.size > 0 || participantSnapshot.size > 0) {
    if (!force) {
      throw new Error(
        [
          "Women's Doubles already has generated bracket data.",
          `Tournament ${tournamentId} category ${womenDoublesCategory.id} is ${String(womenDoublesCategoryDoc.data().status ?? 'unknown')}.`,
          'The source seed is fixed, but adding/replacing teams in this live category now needs a bracket-level decision before automation can continue.',
        ].join(' '),
      );
    }
    await clearCategoryBracketData(db, tournamentId, womenDoublesCategory.id);
  }

  const existingRegistrations = await getDocs(
    query(
      collection(db, 'tournaments', tournamentId, 'registrations'),
      where('categoryId', '==', womenDoublesCategory.id),
    ),
  );

  for (const existingRegistration of existingRegistrations.docs) {
    await deleteDoc(existingRegistration.ref);
  }

  const getOrCreatePlayer = createPlayerResolver(db, tournamentId);
  for (const registration of wdRegistrations) {
    await writeRegistration(
      db,
      tournamentId,
      womenDoublesCategory,
      registration,
      adminId,
      getOrCreatePlayer,
    );
  }

  console.log(
    `  Rebuilt Women's Doubles registrations for existing tournament (${existingRegistrations.size} -> ${wdRegistrations.length})`,
  );
};

export const repairExistingMensDoublesRegistrations = async (
  db: Firestore,
  tournamentId: string,
  adminId: string,
  force = false,
): Promise<void> => {
  // Build authoritative MD ParsedRegistrations from corrections constant.
  // Some partners share the primary player's email — build the emailNameMap so
  // resolveSeedEmail can generate discriminated seed emails for those cases.
  const rawMd = buildAuthoritativeMensDoublesRegistrations();
  const emailNameMap = new Map<string, Set<string>>();
  for (const reg of rawMd) {
    for (const p of reg.participants) {
      const email = p.email.toLowerCase();
      if (!email) continue;
      const names = emailNameMap.get(email) ?? new Set<string>();
      names.add(p.name.toLowerCase());
      emailNameMap.set(email, names);
    }
  }
  const mdRegistrations: ParsedRegistration[] = rawMd.map((raw) => ({
    ...raw,
    participants: raw.participants.map((p) => ({
      ...p,
      seedEmail: resolveSeedEmail(p, emailNameMap),
    })),
  }));

  const categorySnapshots = await getDocs(collection(db, 'tournaments', tournamentId, 'categories'));
  const mensDoublesCategory = findCategoryByKey(
    categorySnapshots.docs.map((snapshot) => ({
      id: snapshot.id,
      name: String(snapshot.data().name ?? ''),
    })),
    'MD',
  );
  const mensDoublesCategoryDoc = categorySnapshots.docs.find(
    (snapshot) => snapshot.id === mensDoublesCategory.id,
  );
  const stageSnapshot = await getDocs(
    collection(db, 'tournaments', tournamentId, 'categories', mensDoublesCategory.id, 'stage'),
  );
  const participantSnapshot = await getDocs(
    collection(db, 'tournaments', tournamentId, 'categories', mensDoublesCategory.id, 'participant'),
  );

  if (!mensDoublesCategoryDoc) {
    throw new Error(`Missing Men's Doubles category document for tournament ${tournamentId}`);
  }

  if (stageSnapshot.size > 0 || participantSnapshot.size > 0) {
    if (!force) {
      throw new Error(
        [
          "Men's Doubles already has generated bracket data.",
          `Tournament ${tournamentId} category ${mensDoublesCategory.id} is ${String(mensDoublesCategoryDoc.data().status ?? 'unknown')}.`,
          "Use force=true to clear bracket data and rebuild from the authoritative roster.",
        ].join(' '),
      );
    }
    await clearCategoryBracketData(db, tournamentId, mensDoublesCategory.id);
  }

  const existingRegistrations = await getDocs(
    query(
      collection(db, 'tournaments', tournamentId, 'registrations'),
      where('categoryId', '==', mensDoublesCategory.id),
    ),
  );

  for (const existingRegistration of existingRegistrations.docs) {
    await deleteDoc(existingRegistration.ref);
  }

  const getOrCreatePlayer = createPlayerResolver(db, tournamentId);
  for (const registration of mdRegistrations) {
    await writeRegistration(
      db,
      tournamentId,
      mensDoublesCategory,
      registration,
      adminId,
      getOrCreatePlayer,
    );
  }

  console.log(
    `  Rebuilt Men's Doubles registrations for existing tournament (${existingRegistrations.size} -> ${mdRegistrations.length})`,
  );
};

export const repairExistingMixedDoublesRegistrations = async (
  db: Firestore,
  tournamentId: string,
  adminId: string,
  force = false,
): Promise<void> => {
  // Build authoritative MXD ParsedRegistrations from corrections constant.
  // Participants[0] = male, participants[1] = female (matches playerGenderForCategory).
  // Some teams share an email — resolveSeedEmail generates discriminated seed emails for them.
  const rawMxd = buildAuthoritativeMixedDoublesRegistrations();
  const emailNameMap = new Map<string, Set<string>>();
  for (const reg of rawMxd) {
    for (const p of reg.participants) {
      const email = p.email.toLowerCase();
      if (!email) continue;
      const names = emailNameMap.get(email) ?? new Set<string>();
      names.add(p.name.toLowerCase());
      emailNameMap.set(email, names);
    }
  }
  const mxdRegistrations: ParsedRegistration[] = rawMxd.map((raw) => ({
    ...raw,
    participants: raw.participants.map((p) => ({
      ...p,
      seedEmail: resolveSeedEmail(p, emailNameMap),
    })),
  }));

  const categorySnapshots = await getDocs(collection(db, 'tournaments', tournamentId, 'categories'));
  const mixedDoublesCategory = findCategoryByKey(
    categorySnapshots.docs.map((snapshot) => ({
      id: snapshot.id,
      name: String(snapshot.data().name ?? ''),
    })),
    'MXD',
  );
  const mixedDoublesCategoryDoc = categorySnapshots.docs.find(
    (snapshot) => snapshot.id === mixedDoublesCategory.id,
  );
  const stageSnapshot = await getDocs(
    collection(db, 'tournaments', tournamentId, 'categories', mixedDoublesCategory.id, 'stage'),
  );
  const participantSnapshot = await getDocs(
    collection(db, 'tournaments', tournamentId, 'categories', mixedDoublesCategory.id, 'participant'),
  );

  if (!mixedDoublesCategoryDoc) {
    throw new Error(`Missing Mixed Doubles category document for tournament ${tournamentId}`);
  }

  if (stageSnapshot.size > 0 || participantSnapshot.size > 0) {
    if (!force) {
      throw new Error(
        [
          'Mixed Doubles already has generated bracket data.',
          `Tournament ${tournamentId} category ${mixedDoublesCategory.id} is ${String(mixedDoublesCategoryDoc.data().status ?? 'unknown')}.`,
          'Use force=true to clear bracket data and rebuild from the authoritative roster.',
        ].join(' '),
      );
    }
    await clearCategoryBracketData(db, tournamentId, mixedDoublesCategory.id);
  }

  const existingRegistrations = await getDocs(
    query(
      collection(db, 'tournaments', tournamentId, 'registrations'),
      where('categoryId', '==', mixedDoublesCategory.id),
    ),
  );

  for (const existingRegistration of existingRegistrations.docs) {
    await deleteDoc(existingRegistration.ref);
  }

  const getOrCreatePlayer = createPlayerResolver(db, tournamentId);
  for (const registration of mxdRegistrations) {
    await writeRegistration(
      db,
      tournamentId,
      mixedDoublesCategory,
      registration,
      adminId,
      getOrCreatePlayer,
    );
  }

  console.log(
    `  Rebuilt Mixed Doubles registrations for existing tournament (${existingRegistrations.size} -> ${mxdRegistrations.length})`,
  );
};

export async function runTNF2026Seed(config: TNF2026SeedConfig): Promise<string> {
  const { db, adminId, orgId } = config;
  const tournamentName = config.tournamentName ?? TNF_2026_TOURNAMENT_NAME;
  const startDateOffset = config.startDateOffset ?? 14;
  const workbookPath = config.workbookPath ?? path.resolve(process.cwd(), TNF_2026_WORKBOOK_FILENAME);
  const organizerIds = [...new Set([adminId, ...(config.organizerIds ?? [])])];
  const parsedWorkbook = parseTNF2026Workbook(workbookPath);

  const existingTournamentSnapshot = await getDocs(
    query(
      collection(db, 'tournaments'),
      where('name', '==', tournamentName),
      ...(orgId ? [where('orgId', '==', orgId)] : []),
    ),
  );

  if (!existingTournamentSnapshot.empty) {
    const existingDoc = existingTournamentSnapshot.docs[0];
    const existingId = existingDoc.id;
    const existingOrganizerIds = Array.isArray(existingDoc.data().organizerIds)
      ? (existingDoc.data().organizerIds as string[])
      : [];
    const mergedOrganizerIds = [...new Set([...existingOrganizerIds, ...organizerIds])];

    if (
      mergedOrganizerIds.length !== existingOrganizerIds.length ||
      (orgId && existingDoc.data().orgId !== orgId)
    ) {
      await updateDoc(existingDoc.ref, {
        organizerIds: mergedOrganizerIds,
        ...(orgId ? { orgId } : {}),
        updatedAt: serverTimestamp(),
      });
      console.log(`  Updated tournament access: ${existingId}`);
    }

    console.log(`  Found existing tournament: ${existingId}`);
    await repairExistingWomenDoublesRegistrations(db, existingId, adminId);
    await repairExistingMensDoublesRegistrations(db, existingId, adminId);
    await repairExistingMixedDoublesRegistrations(db, existingId, adminId);
    return existingId;
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + startDateOffset);
  startDate.setHours(9, 0, 0, 0);

  console.log('\n[1] Creating Tournament...');
  const tournamentRef = await addDoc(collection(db, 'tournaments'), {
    name: tournamentName,
    description: 'TNF USA - Central Illinois Chapter badminton tournament',
    sport: 'badminton',
    format: 'single_elimination',
    status: 'registration',
    state: 'REG_OPEN',
    location: 'Central Illinois',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(new Date(startDate.getTime() + 32 * 60 * 60 * 1000)),
    registrationDeadline: Timestamp.fromDate(new Date()),
    maxParticipants: 250,
    settings: {
      minRestTimeMinutes: 15,
      matchDurationMinutes: 20,
      allowSelfRegistration: false,
      requireApproval: false,
      gamesPerMatch: 3,
      pointsToWin: 21,
      mustWinBy: 2,
      maxPoints: 30,
    },
    ...(orgId ? { orgId } : {}),
    createdBy: adminId,
    organizerIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const tournamentId = tournamentRef.id;
  console.log(`  Created tournament: ${tournamentId}`);

  console.log('\n[2] Creating Categories...');
  const categories: Record<string, CategoryInfo> = {};
  for (const configEntry of CATEGORY_CONFIGS) {
    const categoryRef = await addDoc(collection(db, 'tournaments', tournamentId, 'categories'), {
      tournamentId,
      name: configEntry.name,
      type: configEntry.type,
      gender: configEntry.gender,
      ageGroup: 'open',
      format: 'single_elimination',
      status: 'registration',
      seedingEnabled: true,
      maxParticipants: 64,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    categories[configEntry.key] = {
      id: categoryRef.id,
      key: configEntry.key,
      name: configEntry.name,
    };
    console.log(`  Created category: ${configEntry.name} (${categoryRef.id})`);
  }

  console.log('\n[3] Creating Courts...');
  for (let courtNumber = 1; courtNumber <= 5; courtNumber += 1) {
    await addDoc(collection(db, 'tournaments', tournamentId, 'courts'), {
      tournamentId,
      name: `Court ${courtNumber}`,
      number: courtNumber,
      status: 'available',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  console.log('  Created 5 courts');

  console.log('\n[4] Creating Players and Registrations...');
  const getOrCreatePlayer = createPlayerResolver(db, tournamentId);
  const registrationCounts = new Map<string, number>();
  const importedPlayers = new Set<string>();

  for (const registration of parsedWorkbook.registrations) {
    const category = categories[registration.categoryKey];
    if (!category) {
      throw new Error(`Missing category mapping for ${registration.categoryKey}`);
    }

    for (const participant of registration.participants) {
      importedPlayers.add(participant.seedEmail.toLowerCase());
    }

    await writeRegistration(
      db,
      tournamentId,
      category,
      registration,
      adminId,
      getOrCreatePlayer,
    );

    registrationCounts.set(
      registration.categoryKey,
      (registrationCounts.get(registration.categoryKey) ?? 0) + 1,
    );
  }

  console.log(`  Imported ${importedPlayers.size} unique players`);
  console.log(`  Imported ${parsedWorkbook.registrations.length} registrations`);
  console.log(`  Dropped ${parsedWorkbook.duplicatesDropped} duplicate registration rows`);

  for (const configEntry of CATEGORY_CONFIGS) {
    console.log(
      `  ${configEntry.name}: ${registrationCounts.get(configEntry.key) ?? 0} registrations`,
    );
  }

  return tournamentId;
}
