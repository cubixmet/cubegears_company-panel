// Browser layout smoke tests use intercepted API fixtures, never a live tenant.
// Run `npx playwright install chromium` once, then `npm run test:ui`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROLE_PERMISSION_MODULES } from '../src/config/rolePermissions.js';
import { dashboardMock } from '../src/mock/dashboard.mock.js';
import { mockStaffList } from '../src/mock/staff.mock.js';
import { customersMock } from '../src/mock/customers.mock.js';
import { vehiclesMock } from '../src/mock/vehicles.mock.js';
import { jobsMock } from '../src/mock/jobs.mock.js';
import { invoicesMock } from '../src/mock/invoices.mock.js';
import { paymentsMock } from '../src/mock/payments.mock.js';
import { expensesMock } from '../src/mock/expenses.mock.js';

const port = Number(process.env.UI_TEST_PORT || 5184);
const baseURL = `http://127.0.0.1:${port}`;
const artifacts = process.env.UI_ARTIFACT_DIR || join(tmpdir(), 'cubegears-ui-smoke');
mkdirSync(artifacts, { recursive: true });
const permissions = [...new Set([
  ...ROLE_PERMISSION_MODULES.flatMap(module => module.actions.map(action => `${module.key}.${action}`)),
  'billing.view', 'billing.edit', 'company.manage', 'storage.view', 'storage.manage', 'attendance.self', 'gstr.view',
])];
const user = {id:'owner',name:'Workshop Owner',email:'owner@example.test',companyId:'company-a',
  company:{id:'company-a',name:'Test Workshop'},role:{name:'Owner',permissions:['*']},effectivePermissions:permissions,isCompanyOwner:true};
const settings = Object.fromEntries(['company','operations','billing','inventory','attendance','payroll','notifications','security','integrations'].map(key => [key, {}]));
settings.company = {name:'Test Workshop',country:'India',currency:'INR',timezone:'Asia/Kolkata'};
const bundles = [
  {id:null,key:'customers',name:'Customers',features:[{key:'customers',label:'Customers'}],perUserCredits:'0.00',totalCredits:'0.00',billingType:'monthly',purchaseEnabled:false,purchaseDisabledReason:'MODULE_PRICE_NOT_SET'},
  {id:'jobs',name:'Jobs',features:[{key:'jobs',label:'Jobs'}],perUserCredits:'20.00',totalCredits:'20.00',billingType:'monthly',purchaseEnabled:true},
];
function fixture(path) {
  if(path==='/auth/me') return user;
  // Zero-value synthetic GSTR preparation fixture; no tax liabilities are inferred.
  if(path==='/gstr/overview') return {
    company: { gstin: null },
    overview: { taxable: '0.00', invoiceCount: 0, outputGST: '0.00',
      eligibleITC: null, estimatedNetLiability: null, cgst: '0.00',
      sgst: '0.00', igst: '0.00', purchaseGST: '0.00', verifiedPurchaseTax: null },
    gstr1: { rows: [] }, gstr2b: { purchases: [] }, hsn: { rows: [] }, issues: [],
  };
  if(path==='/billing/documents/gst-context') return {registered:false};
  if(path.startsWith('/billing/documents')) {
    const document={id:'INV-0001',number:'INV-0001',kind:'invoice',invoiceType:'regular',
      status:'Draft',date:'2026-10-19',seller:{name:'Test Workshop'},
      customer:{name:'Rahul Kumar'},vehicle:{registration:'KL10AB1234'},items:[],
      discount:0,adjustment:0,taxMode:'none',paid:0};
    return path==='/billing/documents'?[document]:document;
  }
  if(path==='/payroll/daily-wages') return {
    totalWorkers:1,todayExpense:600,outstanding:600,workersUnpaid:1,totalPayments:0,
    todayAttendance:{full:1,half:0,pending:0},
    employees:[{
      id:'EMP-0012',name:'Ajmal K',employeeCode:'EMP-0012',designation:'Mechanic',
      branchId:'branch-a',branchName:'Main Branch',dailyRate:600,currentBalance:600,
      lastPaymentDate:'2026-10-20',
      today:{finalized:true,attendance:'Full Day',totalWage:600,extraEarnings:0},
    }],
  };
  if(path==='/payroll/daily-wages/history') return [{
    id:'HIST-001',date:'2026-10-28',employeeId:'EMP-0012',
    employeeName:'Ajmal K',branchId:'branch-a',branchName:'Main Branch',
    attendance:'Full Day',dailyRate:600,baseWage:600,extras:0,
    adjustments:0,total:600,paymentStatus:'Unpaid',
  }];
  if(path==='/payroll/daily-wages/payments') return [{
    id:'PAY-001',date:'2026-10-28',employeeId:'EMP-0012',
    employeeName:'Ajmal K',branchId:'branch-a',branchName:'Main Branch',
    amount:300,method:'Cash',reference:'PAY-TEST',reversed:false,
  }];
  if(path.startsWith('/payroll/daily-wages/employees/')) return {
    employee:mockStaffList[0], currentRate:600, currentBalance:600, totalEarned:600, totalPaid:0,
    today:{date:'2026-10-19', finalized:true, attendance:'Full Day', totalWage:600, baseWage:600, extraEarnings:0},
    rates:[],history:[],extras:[],payments:[],audit:[],
  };
  if(path.startsWith('/saas/storage/history/')) return {
    date:'2026-10-19', usedGb:0, fileCount:0, files:[], charge:0, rate:null,
  };
  if(path.startsWith('/attendance-manager/staff-details/')) return {
    staffInfo:{id:'EMP-0012', name:'Ajmal K', designation:'Mechanic', branch:'Main', shift:'General'},
    attendanceSummary:{date:'2026-10-19', status:'Present', workedHours:'8h', lateMinutes:0, earlyExitMinutes:0},
    sessions:[], correctionInfo:null, leaveInfo:null, auditHistory:[],
  };
  if(path==='/e-way-bills') return [];
  if(path==='/e-way-bills/from-context') return { from: {
    gstin:'32ABCDE1234F1Z5', tradeName:'Test Workshop',address:'Main Road',
    place:'Thrissur',pincode:'680001',stateCode:'32',
  },branchId:'BR-01' };
  if(path==='/e-way-bills/from-context') return {
    from:{gstin:'32ABCDE1234F1Z5',tradeName:'Test Workshop',address:'Workshop Lane',
      place:'Thrissur',pincode:'680001',stateCode:'32'},branchId:'BR-01',
  };
  if(path.startsWith('/e-way-bills/')) return {id:'EWB-001',status:'Draft',supplyType:'Outward',subSupplyType:'Supply',transactionType:'Regular',documentType:'Tax Invoice',documentNo:'INV-0001',documentDate:'2026-10-19',from:{tradeName:'Test Workshop',stateCode:'32'},to:{tradeName:'Test Customer',stateCode:'32'},items:[],transport:{mode:'Road',distanceKm:'10',vehicleNo:'KL10AB1234'}};
  // Supplier finance fixtures are read-only. Smoke tests never write tenant data.
  if(path==='/stock/suppliers') return [
    {id:'00000000-0000-4000-8000-000000000081',name:'Fixture Auto Parts',phone:'9876543210',email:'parts@example.test'},
  ];
  if(path==='/stock/purchases' || path==='/stock/purchase-orders') return [
    {id:'00000000-0000-4000-8000-000000000082',number:'PO-TEST-01',
     supplier:'00000000-0000-4000-8000-000000000081',status:'Received',total:'1800.00'},
  ];
  if(path==='/stock/supplier-credits') return [
    {id:'00000000-0000-4000-8000-000000000083',
     purchaseOrder:'00000000-0000-4000-8000-000000000082',purchaseNumber:'PO-TEST-01',
     supplierId:'00000000-0000-4000-8000-000000000081',supplierName:'Fixture Auto Parts',
     total:'1800.00',paid:'200.00',outstanding:'1600.00',
     dueDate:'2026-12-30',status:'Partially Paid'},
  ];
  if(path==='/stock/supplier-payments') return [
    {id:'00000000-0000-4000-8000-000000000084',creditId:'00000000-0000-4000-8000-000000000083',
     supplierName:'Fixture Auto Parts',purchaseNumber:'PO-TEST-01',
     date:'2026-11-05',amount:'200.00',method:'Cash',reference:'',
     expenseId:'00000000-0000-4000-8000-000000000085'},
  ];
  if(path==='/employees') return mockStaffList.map(row => ({...row, photo:''}));
  const records = {employees:mockStaffList, customers:customersMock, vehicles:vehiclesMock,
    jobs:jobsMock, invoices:invoicesMock, payments:paymentsMock, expenses:expensesMock};
  const [,resource,id,subresource] = path.split('/');
  if(records[resource] && !subresource) {
    if(!id) return records[resource];
    const row=records[resource].find(row=>row.id===id);
    if(row) return {...row, photo:'', ...(resource==='invoices'?{items:[],invoiceType:'non-gst'}:{})};
  }
  if(path==='/saas/credits/access') return {companyId:'company-a',permissions,enabledModules:permissions.map(code=>code.split('.')[0]),freeModules:['dashboard','staff','settings','roles','billing'],enforcementEnabled:true,isCompanyOwner:true,canManageFeatures:true};
  // Simulate the existing Django health contract in isolated UI fixture mode.
  if(path==='/health') return {status:'ok',service:'cubegears-backend',api_version:'v1'};
  if(path==='/dashboard') return structuredClone(dashboardMock);
  if(path==='/settings') return settings;
  if(path.startsWith('/settings/')) return settings[path.split('/').pop()] || {};
  if(path==='/company/me') return user.company;
  if(path==='/saas/credits/overview') return {balance:'516500.00',canManage:true,checkoutAvailable:false};
  if(path==='/saas/credits/bundles') return bundles;
  if(path==='/saas/credits/billing-cycle') return {enabled:false};
  if(path==='/saas/credits/account') return {company:user.company,users:[]};
  if(path==='/saas/billing') return {plan:null,usage:{seatsUsed:0},users:[],invoices:[]};
  if(path==='/saas/storage') return {usedGb:0,files:[],settings:{allowedTypes:['image/png'],maxFileMb:10,retentionDays:0},billing:{creditsPerGb:'10',includedGb:'0',period:'monthly',active:true}};
  if(path==='/saas/storage/events') return {count:0,results:[]};
  if(path==='/attendance-manager/approvals') return [{
    id:'LEAVE-TEST-1',type:'Leave Request',status:'Pending',staffName:'Belle Trujillo',
    staffId:'EMP-0001',startDate:'2026-10-30',endDate:'2026-10-30',
    totalDays:1,reason:'Personal leave request',halfDay:false,canReview:true,
  },{
    id:'LEAVE-SELF-TEST',type:'Leave Request',status:'Pending',staffName:'Logged In Owner',
    staffId:'EMP-0002',startDate:'2026-10-30',endDate:'2026-10-30',
    totalDays:1,reason:'Own leave request',halfDay:false,canReview:false,
    reviewBlockReason:'Your own request must be reviewed by another authorized manager.',
  }];
  if(path==='/attendance/status') return {status:'CLOCKED_OUT',workedHours:'0h'};
  return [];
}
const source = readFileSync(new URL('../src/routes/AppRoutes.jsx', import.meta.url),'utf8');
const sampleIds={staffId:'EMP-0012', complaintId:'CMP-01', ewbId:'EWB-001', date:'2026-10-19'};
const templates=[...source.matchAll(/<Route path="([^"]+)"/g)].map(([,path])=>path);
const paths=[...new Set(templates.map(path=>path.replace(/:([A-Za-z]+)/g,(_,key)=>{
  if(sampleIds[key])return sampleIds[key];
  if(path.startsWith('/staff/'))return 'EMP-0012';
  return ({customers:'CUS-0001',vehicles:'VEH-0001',jobs:'JOB-00251',invoices:'INV-0001',
    payments:'PAY-0001',expenses:'EXP-0001',services:'SVC-001',reports:'REP-001',notifications:'NOT-001'})[path.split('/')[1]] || 'fixture-id';
}).replace('*','fixture-unknown')))].filter(path=>!process.env.UI_PATH_FILTER||path.includes(process.env.UI_PATH_FILTER));
const profiles = process.env.UI_QUICK ? [{width:390,height:844,theme:'light'}] : [
  {width:320,height:720,theme:'dark'}, {width:375,height:812,theme:'light'},
  {width:390,height:844,theme:'dark'}, {width:430,height:932,theme:'light'},
  {width:768,height:1024,theme:'dark'}, {width:1024,height:768,theme:'light'},
  {width:1440,height:1000,theme:'dark'}, {width:1920,height:1080,theme:'light'},
];
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js',...(process.env.UI_PRODUCTION ? ['preview'] : []),'--host','127.0.0.1','--port',String(port),'--strictPort'],{
  cwd:new URL('..',import.meta.url),env:{...process.env,VITE_API_URL:'http://127.0.0.1:8000/api/v1'},stdio:['ignore','pipe','pipe'],
});
// A Vite production preview can be ready without printing "Local:" on stdout.
const startupErrors = [];
server.stderr.on('data', data => startupErrors.push(data.toString()));
const waitForServer = async () => {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw Error(`Vite exited (${server.exitCode}): ${startupErrors.join('').slice(-2000)}`);
    }
    try {
      const response = await fetch(baseURL, { signal: AbortSignal.timeout(2500) });
      if (response.ok) return;
    } catch { /* The preview server is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw Error(`Vite preview never served HTTP after 60s: ${startupErrors.join('').slice(-2000)}`);
};

let browser;
try {
  await waitForServer();
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--use-gl=disabled']}: {})});
  const failures=[];
  let tested=0;
  await Promise.all(profiles.map(async (profile) => {
    const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},colorScheme:profile.theme==='dark'?'dark':'light'});
    await context.addInitScript(({user,theme})=>{
      localStorage.setItem('auth_token','fixture-token');localStorage.setItem('auth_user',JSON.stringify(user));
      if(!localStorage.getItem('cubegears-theme'))localStorage.setItem('cubegears-theme',theme);
    },{user,theme:profile.theme});
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      return url.origin===baseURL||url.pathname.startsWith('/api/v1/')?route.continue():route.abort();
    });
    await context.route('**/api/v1/**',async route=>{
      if(!['GET','HEAD'].includes(route.request().method())) {
        await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Smoke tests do not write tenant data.'})});return;
      }
      const path=new URL(route.request().url()).pathname.replace('/api/v1','').replace(/\/$/,'');
      if (/^\/(?:billing\/documents|e-way-bills)\/[^/]+\/pdf$/.test(path)) {
        await route.fulfill({status:200,contentType:'application/pdf',body:'%PDF-1.4\n% UI fixture\n%%EOF'});
        return;
      }
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture(path))});
    });
    const page=await context.newPage();const errors=[];
    page.setDefaultTimeout(5000);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&message.text().includes('React render error'))errors.push(message.text());});
    let firstNavigation=true;
    for(const path of paths) {
      console.log(`Checking ${profile.width}px ${path}`);
      errors.length=0;
      try {
        if(firstNavigation) {
          await page.goto(baseURL+path,{waitUntil:'networkidle',timeout:15000});
          firstNavigation=false;
        } else {
          await page.evaluate(path=>{
            window.history.pushState({},'',path);
            window.dispatchEvent(new PopStateEvent('popstate'));
          },path);
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          await page.waitForLoadState('networkidle');
        }
        await page.locator('.route-loading').waitFor({state:'hidden',timeout:15000});
        await page.waitForFunction(()=>document.body.innerText.length>=20);
        // Suppliers has one drawer link and four page tabs (no slide-out submenu).
        if(path==='/suppliers' && (profile.width===390 || profile.width===1440)) {
          await page.getByRole('heading',{name:'Suppliers',exact:true}).waitFor({state:'visible'});
          await page.locator('a.cg-supplier-name-link:visible').first().waitFor({state:'visible'});
          // Supplier actions are now on /suppliers/:id, not separate tabs.
          if (await page.getByRole('navigation',{name:'Supplier sections'}).count()) {
            throw Error('Obsolete supplier finance tabs should be removed');
          }
          const supplierProfile = page.locator('a.cg-supplier-name-link:visible').first();
          await supplierProfile.waitFor({state:'visible'});
          const target = await supplierProfile.getAttribute('href');
          if (!target?.startsWith('/suppliers/')) throw Error('Supplier must link to its detail profile');
          const drawerMode=profile.width<1024;
          if(drawerMode) await page.getByRole('button',{name:'Open all authorized pages'}).click();
          const sidebar=page.locator(drawerMode ? '.mobile-drawer' : '.app-sidebar');
          const supplierLink=sidebar.getByRole('link',{name:'Suppliers',exact:true});
          await supplierLink.waitFor({state:'visible'});
          if(await supplierLink.getAttribute('href')!=='/suppliers') throw Error('Suppliers parent link is incorrect');
          if(await sidebar.locator('[id*="supplier-"][id*="submenu"]').count()) throw Error('Old Suppliers submenu is still present');
          if(drawerMode) await sidebar.getByRole('button',{name:'Close menu',exact:true}).click();
        }
        // Job Card creation: exercise the actual React form, image blob URLs,
        // computed responsive grid, light/dark tokens, and accordion state.
        if(path==='/jobs/new') {
          const sectionOrder=await page.evaluate(()=>[...document.querySelectorAll('.job-create-form > .job-create-section')]
            .map(node=>node.querySelector('h2')?.textContent.trim() || ''));
          if(sectionOrder.slice(0,5).map(label=>label.replace(/^\d+\s*/, '')).join(' | ') !==
            'Customer & Job Details | Customer Complaints | Vehicle Details | Technician & Service Assignment | Vehicle Photos / Inspection')
            throw Error('Job Card section order is incorrect: '+sectionOrder.join(' | '));
          if(await page.getByRole('heading',{name:/Customer Complaints/}).count()!==1)
            throw Error('Job Card has duplicate Customer Complaints headings');
          const firstComplaint=page.locator('.job-complaint-row textarea').first();
          await firstComplaint.fill('Noise when braking');
          await page.getByRole('button',{name:'Add Complaint'}).click();
          if(await page.locator('.job-complaint-row').count()!==2)
            throw Error('Add Complaint did not create another editable complaint');
          await page.locator('.job-complaint-row textarea').nth(1).fill('AC not cooling');
          await page.getByRole('button',{name:'Remove complaint 2'}).click();
          await page.getByRole('button',{name:'Advanced',exact:true}).click();
          await page.getByRole('button',{name:'Simple',exact:true}).click();
          if(await firstComplaint.inputValue()!=='Noise when braking' ||
            await page.locator('.job-complaint-row').count()!==1)
            throw Error('Complaints were lost after editing, removal, or switching modes');

          const accordion=page.getByRole('button',{name:/Advanced Vehicle Details/});
          if(await accordion.getAttribute('aria-expanded')!=='false' ||
            await page.locator('#job-create-vehicle-advanced-content').count())
            throw Error('Collapsed Vehicle Details contains an unwanted empty box');
          const collapsedHeight=await page.locator('.job-create-vehicle-advanced').evaluate(el=>el.getBoundingClientRect().height);
          if(collapsedHeight>80) throw Error('Collapsed Vehicle Details is too tall: '+collapsedHeight);
          await accordion.click();
          await page.locator('input[name="vin"]').fill('VIN-TEST-123');
          await accordion.click();
          await accordion.click();
          if(await page.locator('input[name="vin"]').inputValue()!=='VIN-TEST-123')
            throw Error('VIN was cleared when opening and closing the accordion');

          const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
          await page.locator('input[aria-label="Upload vehicle photos from gallery"]').setInputFiles(
            Array.from({length:5},(_,i)=>({name:'vehicle-'+i+'.png',mimeType:'image/png',buffer:image}))
          );
          if(await page.locator('.vehicle-camera-queued').count()!==5)
            throw Error('Five uploaded pictures should generate five independent thumbnails');
          const grid=await page.locator('.vehicle-camera-queue-grid').evaluate(el=>{
            const rect=el.getBoundingClientRect();
            const columns=getComputedStyle(el).gridTemplateColumns.split(/\s+/).filter(Boolean);
            const image=el.querySelector('.vehicle-camera-preview-button img');
            const thumb=image?.getBoundingClientRect();
            return {columns:columns.length, right:rect.right,
              thumbWidth:thumb?.width, thumbHeight:thumb?.height,
              fit:image && getComputedStyle(image).objectFit};
          });
          const expectedColumns=profile.width<=767?2:profile.width<=1100?3:4;
          if(grid.columns!==expectedColumns)
            throw Error('Incorrect responsive photo columns at '+profile.width+'px: '+JSON.stringify(grid));
          if(grid.right>profile.width+2)
            throw Error('Vehicle photo grid overflows viewport: '+JSON.stringify(grid));
          if(grid.fit!=='cover'||!grid.thumbWidth||!grid.thumbHeight||
            Math.abs(grid.thumbWidth/grid.thumbHeight-4/3)>0.15)
            throw Error('Vehicle photo thumbnails have incorrect aspect ratio: '+JSON.stringify(grid));
          if(await page.getByText('Ready to upload',{exact:true}).count()!==5)
            throw Error('Each pending photo must have an upload status');
          await page.locator('.vehicle-camera-preview-button').first().click();
          const lightbox=page.getByRole('dialog',{name:'Vehicle photo preview'});
          await lightbox.waitFor({state:'visible'});
          const fit=await lightbox.locator('img').evaluate(el=>getComputedStyle(el).objectFit);
          if(fit!=='contain') throw Error('Full-size photo preview must preserve aspect ratio');
          await lightbox.getByRole('button',{name:'Close photo preview'}).click();
          await lightbox.waitFor({state:'hidden'});
          await page.locator('.vehicle-camera-remove-photo').first().click();
          if(await page.locator('.vehicle-camera-queued').count()!==4)
            throw Error('Removing one photo should leave all other queued photos');
        }

        if(path==='/plans') {
          if(new URL(page.url()).pathname!=='/account/credits/buy') throw Error('Redirect did not reach module marketplace');
          if(new URL(page.url()).searchParams.has('month')) throw Error('Payroll filters leaked into unrelated route');
        }
        if(path==='/signup') {
          if(new URL(page.url()).pathname!=='/signup') throw Error('Workshop mobile signup must remain public');
          await page.getByRole('heading',{name:'Create a workshop'}).waitFor({state:'visible'});
          const mobile=page.locator('input[type="tel"]');
          if(!(await mobile.count())) throw Error('Mobile number field missing on workshop registration');
          if(await page.locator('input[type="email"]').getAttribute('required')!==null)
            throw Error('Email must remain optional for workshop registration');
        }
        const text=await page.locator('body').innerText();
        if(text.length<20)throw Error('Blank page');
        if(errors.length)throw Error(errors.join('; '));
        if(path!='/access-denied' && page.url().includes('/access-denied'))throw Error('Authorized fixture denied');
        const overflow=await page.evaluate(()=>{
          const nodes=[document.documentElement,...document.querySelectorAll('.app-content,.login-shell')];
          return nodes.filter(node=>node.clientWidth>0&&node.scrollWidth>node.clientWidth+2).map(node=>node.className||node.tagName);
        });
        if(overflow.length)throw Error('Horizontal page overflow: '+overflow.join(', '));
        // Shared real form components: outlined labels, proper border ownership,
        // filled-state label persistence, and keyboard-accessible searchable picker.
        if ((path==='/customers/new' || path==='/vehicles/new') &&
            (profile.width===390 || profile.width===1440)) {
          const controls = page.locator('.cg-floating-field > [data-cg-input-shell]');
          if(await controls.count()<3) throw Error('Shared outlined fields are missing on '+path);
          const state = await controls.first().evaluate(shell=>{
            const input = shell.querySelector('input,select');
            const styles = getComputedStyle(shell);
            const inner = getComputedStyle(input);
            return {outerBorder:parseFloat(styles.borderLeftWidth),
              innerBorder:parseFloat(inner.borderLeftWidth),
              height:shell.getBoundingClientRect().height,
              font:parseFloat(inner.fontSize),
              label:!!shell.querySelector('label[for]')};
          });
          if(!state.label || state.outerBorder<.9 || state.innerBorder>.1 ||
              state.height<44 || state.height>51 || state.font<15.5) {
            throw Error('Invalid shared field shell: '+JSON.stringify(state));
          }
          if(path==='/customers/new') {
            const name=page.getByLabel('Customer Name',{exact:false});
            await name.fill('Test Workshop Customer');
            await name.blur();
            const float=await name.evaluate(field=>{
              const shell=field.closest('[data-cg-input-shell]');
              const label=shell.querySelector('.cg-floating-label');
              const labelRect=label.getBoundingClientRect();
              const shellTop=shell.getBoundingClientRect().top;
              return {labelCenter:(labelRect.top+labelRect.bottom)/2,
                labelTop:labelRect.top,shellTop};
            });
            // A floating label straddles its input border and is centered on it.
            if(Math.abs(float.labelCenter-float.shellTop)>3 || float.labelTop>=float.shellTop) {
              throw Error('Filled Customer Name label does not float: '+JSON.stringify(float));
            }
          }
          if(path==='/vehicles/new') {
            const picker=page.getByRole('combobox',{name:'Customer Owner'});
            await picker.click();
            const search=page.getByRole('searchbox',{name:'Search Customer Owner'});
            await search.waitFor({state:'visible'});
            await search.press('ArrowDown');
            await search.press('ArrowUp');
            await search.press('Enter');
            if(await picker.getAttribute('aria-expanded')!=='false') {
              throw Error('Searchable Customer Owner select did not close after keyboard selection');
            }
          }
        }
        if(path==='/jobs') {
          // All viewport/theme profiles exercise the actual rendered toolbar.
          const grid = page.locator('.jobs-toolbar-combined');
          await grid.waitFor({state:'visible'});
          const metrics = await grid.evaluate(root => {
            const dashboard = root.closest('.jobs-dashboard');
            const elements = [...root.querySelectorAll('.jobs-filter-field,.jobs-toolbar-actions')];
            const fields = elements.map(node => {
              const rect = node.getBoundingClientRect();
              const label = node.querySelector('.jobs-filter-label')?.getBoundingClientRect();
              const control = node.querySelector('.jobs-search,select,input,.jobs-toolbar-actions-content')?.getBoundingClientRect();
              return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,
                labelAbove:!label||!control||label.bottom<=control.top+1};
            });
            const rows = new Set(fields.map(rect=>Math.round(rect.top/3)*3)).size;
            const overlaps = fields.some((a,i)=>fields.some((b,j)=>
              j>i && a.left<b.right-2 && b.left<a.right-2 && a.top<b.bottom-2 && b.top<a.bottom-2));
            const controls = [...root.querySelectorAll('input,select')].map(node=>({
              height:node.getBoundingClientRect().height,
              font:parseFloat(getComputedStyle(node).fontSize),
            }));
            return {containerWidth:dashboard?.getBoundingClientRect().width,
              rows,overlaps,labelAbove:fields.every(x=>x.labelAbove),
              fieldCount:fields.length,controls,
              positions:elements.map((node,i)=>({field:node.className,top:fields[i].top,height:fields[i].bottom-fields[i].top})),
              columns:getComputedStyle(root).gridTemplateColumns};
          });
          if(metrics.fieldCount!==8 || metrics.overlaps || !metrics.labelAbove) {
            throw Error('Job Cards filter grid has missing or overlapping fields: '+JSON.stringify(metrics));
          }
          if(metrics.containerWidth>=920 && metrics.rows!==2) {
            throw Error('Desktop job filter toolbar must have exactly two rows: '+JSON.stringify(metrics));
          }
          if(metrics.controls.some(x=>x.height<43 || x.height>49)) {
            throw Error('Job filter inputs are not consistent 44–48px controls: '+JSON.stringify(metrics));
          }
          if(profile.width<=640 && metrics.controls.some(x=>x.font<15.5)) {
            throw Error('Mobile job filter value font below 16px: '+JSON.stringify(metrics));
          }
          if(profile.width===390 || profile.width===1440) {
            const search = page.getByRole('searchbox',{name:'Search job cards'});
            await search.fill('KL10');
            await page.waitForFunction(()=>new URL(location.href).searchParams.get('q')==='KL10');
            await page.getByLabel('Filter job cards by status').selectOption('Active');
            await page.waitForFunction(()=>new URL(location.href).searchParams.get('status')==='active');
            await page.getByLabel('Clear job search').click();
            await page.waitForFunction(()=>!new URL(location.href).searchParams.has('q'));
            if(new URL(page.url()).searchParams.get('status')!=='active') {
              throw Error('Clearing Job Cards search unexpectedly cleared status filter');
            }
            await page.getByLabel('Job card created from date').fill('2026-01-01');
            await page.getByLabel('Job card created to date').fill('2026-12-31');
            await page.waitForFunction(()=>new URL(location.href).searchParams.get('to')==='2026-12-31');
            await page.getByRole('button',{name:'Reset Filters'}).click();
            await page.waitForFunction(()=>new URL(location.href).searchParams.toString()==='');
          }
        }
        if(profile.width < 768) {
          const undersized = await page.locator('.ui-icon-button').evaluateAll(nodes => nodes
            .filter(node => node.getClientRects().length)
            .filter(node => { const rect=node.getBoundingClientRect(); return rect.width < 44 || rect.height < 44; })
            .map(node => node.getAttribute('aria-label') || 'Unlabelled icon action'));
          if(undersized.length) throw Error('Small touch controls: '+undersized.join(', '));
        }
        if(['/login','/settings','/staff-management/add','/customers/new','/vehicles/new'].includes(path)){
          const sizes=await page.locator('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),textarea,select').evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length).map(e=>parseFloat(getComputedStyle(e).fontSize)));
          if(sizes.some(size=>size<16))throw Error('Form control text below 16px: '+sizes.join(','));
        }
        // Services: verify computed borderless styles on actual rendered controls.
        // CI reads forms only and never posts a service or category.
        if((path==='/services/new' || path==='/services') &&
            (profile.width===390 || profile.width===1440)){
          const checkFields=async (selector, expectedMin=4)=>{
            const form=page.locator(selector);
            await form.waitFor({state:'visible'});
            const results=await form.evaluate(root=>{
              const inputs=[...root.querySelectorAll('input,select,textarea')]
                .filter(el=>el.getClientRects().length)
                .map(el=>({
                  border:parseFloat(getComputedStyle(el).borderLeftWidth),
                  font:parseFloat(getComputedStyle(el).fontSize),
                  height:Math.round(el.getBoundingClientRect().height),
                }));
              const labels=[...root.querySelectorAll('.service-field > span')]
                .filter(el=>el.getClientRects().length)
                .map(el=>parseFloat(getComputedStyle(el).fontSize));
              const buttons=[...root.querySelectorAll('.service-form-actions button')]
                .filter(el=>el.getClientRects().length)
                .map(el=>Math.round(el.getBoundingClientRect().height));
              return {inputs,labels,buttons};
            });
            if(results.inputs.length<expectedMin ||
              results.inputs.some(input=>input.border>0 || input.font<16 || input.height<48) ||
              results.labels.some(size=>size<14) ||
              results.buttons.some(height=>height<48)){
              throw Error('Services borderless form style mismatch: '+
                JSON.stringify({path,width:profile.width,...results}));
            }
          };
          if(path==='/services/new'){
            await checkFields('.service-form-page form.service-form',8);
          } else {
            const search=page.locator('.service-dashboard-search');
            await search.waitFor({state:'visible'});
            const results=await search.evaluate(shell=>{
              const input=shell.querySelector('input');
              return {
                border:parseFloat(getComputedStyle(shell).borderLeftWidth),
                height:Math.round(shell.getBoundingClientRect().height),
                innerBorder:parseFloat(getComputedStyle(input).borderLeftWidth),
                innerFont:parseFloat(getComputedStyle(input).fontSize),
              };
            });
            if(results.border>0||results.innerBorder>0||results.height<48||results.innerFont<16)
              throw Error('Services directory search style mismatch: '+JSON.stringify(results));
            // Service Categories are now a single compact modal, not a
            // separate Categories tab. Exercise the actual Add Category button.
            await page.getByRole('button',{name:'Add Category',exact:true}).click();
            await checkFields('.service-category-form',3);
            await page.getByRole('dialog',{name:'Add Category'})
              .getByRole('button',{name:'Close dialog'}).click();
          }
        }
        // Payments UI: inspect computed styles on actual entry and dashboard controls.
        // Never submit/record a payment: the mock API fixture is read-only.
        if(['/payments','/payments/new'].includes(path) &&
            [390,1440].includes(profile.width)) {
          if(path==='/payments/new'){
            const entry=page.locator('.payments-entry-page .payment-form-card');
            await entry.waitFor({state:'visible'});
            const metrics=await entry.evaluate(root=>{
              const inputs=[...root.querySelectorAll('.payment-form-grid input,.payment-form-grid select')]
                .filter(node=>node.getClientRects().length)
                .map(node=>{
                  const c=getComputedStyle(node);
                  return {font:parseFloat(c.fontSize), border:parseFloat(c.borderLeftWidth),
                    height:Math.round(node.getBoundingClientRect().height)};
                });
              const labels=[...root.querySelectorAll('.payment-form-grid label > span')]
                .map(node=>parseFloat(getComputedStyle(node).fontSize));
              const actions=[...root.querySelectorAll('.payment-form-actions button')]
                .map(node=>Math.round(node.getBoundingClientRect().height));
              const grid=root.querySelector('.payment-form-grid');
              return {inputs,labels,actions,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length};
            });
            const cols=profile.width<=760?1:2;
            if(metrics.inputs.length<6 || metrics.inputs.some(x=>x.font<16||x.border>0||x.height<48)
              || metrics.labels.some(x=>x<14) || metrics.actions.some(x=>x<48)
              || metrics.columns!==cols){
              throw Error('Payment form computed styles mismatch: '+
                JSON.stringify({width:profile.width,...metrics}));
            }
          } else {
            const toolbar=page.locator('.payments-dashboard-toolbar');
            await toolbar.waitFor({state:'visible'});
            const metrics=await toolbar.evaluate(root=>
              [...root.querySelectorAll('.payments-dashboard-search,.payments-dashboard-filter')].map(shell=>{
                const inner=shell.querySelector('input,select');
                return {border:parseFloat(getComputedStyle(shell).borderLeftWidth),
                  height:Math.round(shell.getBoundingClientRect().height),
                  font:parseFloat(getComputedStyle(inner).fontSize),
                  innerBorder:parseFloat(getComputedStyle(inner).borderLeftWidth)};
              })
            );
            if(metrics.length!==3 || metrics.some(x=>x.border>0||x.innerBorder>0||x.font<16||x.height<48)){
              throw Error('Payment filter computed styles mismatch: '+
                JSON.stringify({width:profile.width,metrics}));
            }
          }
        }
        if(path==='/account/security' && (profile.width===390 || profile.width===1440)) {
          // Real computed styles: the password input must not paint a second
          // inset rectangle or overflow its lock/visibility controls.
          const form=page.locator('.account-security-form');
          await form.waitFor({state:'visible'});
          const measured=await form.evaluate(node=>
            [...node.querySelectorAll('.account-security-input-row')].map(row=>{
              const input=row.querySelector('input');
              const icon=row.querySelector('svg.account-security-field-icon');
              const toggle=row.querySelector('button.account-security-visibility-toggle');
              const outer=getComputedStyle(row);
              const inner=getComputedStyle(input);
              const box=row.getBoundingClientRect();
              const textBox=input.getBoundingClientRect();
              const toggleBox=toggle.getBoundingClientRect();
              const iconBox=icon.getBoundingClientRect();
              return {
                border:parseFloat(outer.borderLeftWidth),
                height:Math.round(box.height),
                innerBorder:parseFloat(inner.borderLeftWidth),
                innerBackground:inner.backgroundColor,
                innerRadius:parseFloat(inner.borderTopLeftRadius),
                font:parseFloat(inner.fontSize),
                iconFits:iconBox.left>=box.left && iconBox.right<textBox.left,
                toggleFits:toggleBox.left>=textBox.right-1 && toggleBox.right<=box.right+1,
                buttonHeight:Math.round(toggleBox.height),
                width:Math.round(textBox.width),
              };
            })
          );
          if(measured.length!==3 || measured.some(field=>
              field.border>0 || field.height<50 || field.innerBorder>0 ||
              field.innerBackground!=='rgba(0, 0, 0, 0)' || field.innerRadius>0 ||
              field.font<16 || field.buttonHeight<44 || field.width<100 ||
              !field.iconFits || !field.toggleFits)) {
            throw Error('Account Security password input layout mismatch: '+
              JSON.stringify({width:profile.width,measured}));
          }
          const current=page.locator('input[aria-label="Current password"]');
          await current.fill('test-password-only');
          await page.getByRole('button',{name:'Show current password'}).click();
          if(await current.getAttribute('type')!=='text') {
            throw Error('Account Security visibility toggle failed');
          }
          await page.getByRole('button',{name:'Hide current password'}).click();
          if(await current.getAttribute('type')!=='password') {
            throw Error('Account Security password did not hide');
          }
          const confirm=page.locator('input[aria-label="Confirm new password"]');
          await page.getByRole('button',{name:'Show confirmed password'}).click();
          if(await confirm.getAttribute('type')!=='text') {
            throw Error('Account Security confirmed password visibility failed');
          }
        }
        // Customer creation popup: inspect rendered fields (not only CSS text).
        // Keep it read-only; never submit a customer in CI.
        if(path==='/customers' && (profile.width===390 || profile.width===1440)) {
          await page.getByRole('button',{name:'Add Customer'}).first().click();
          const dialog=page.getByRole('dialog',{name:'Add Workshop Customer'});
          await dialog.waitFor({state:'visible'});
          const form=dialog.locator('form.customer-directory-form');
          const measurements=await form.evaluate(root=>{
            const shells=[...root.querySelectorAll('[data-cg-input-shell="true"]')];
            const controls=shells.map(shell=>{
              const control=shell.querySelector('input,select');
              return {
                border:parseFloat(getComputedStyle(shell).borderLeftWidth),
                height:Math.round(shell.getBoundingClientRect().height),
                textSize:control?parseFloat(getComputedStyle(control).fontSize):0,
                controlBorder:control?parseFloat(getComputedStyle(control).borderLeftWidth):0,
              };
            });
            const notes=[...root.querySelectorAll('textarea')].map(el=>({
              border:parseFloat(getComputedStyle(el).borderLeftWidth),
              textSize:parseFloat(getComputedStyle(el).fontSize),
            }));
            const labels=[...root.querySelectorAll('.ui-label')].map(el=>
              parseFloat(getComputedStyle(el).fontSize));
            const firstGrid=root.querySelector('.customer-directory-form-grid');
            const columns=firstGrid?getComputedStyle(firstGrid).gridTemplateColumns.split(' ').length:0;
            const action=root.querySelector('.customer-directory-form-submit');
            return {controls,notes,labels,columns,
              actionHeight:action?Math.round(action.getBoundingClientRect().height):0};
          });
          const expectedColumns=profile.width<=520?1:2;
          if(!measurements.controls.length||!measurements.notes.length||
            measurements.controls.some(item=>item.border>0||item.controlBorder>0||
              item.height<48||item.textSize<16)||
            measurements.notes.some(item=>item.border>0||item.textSize<16)||
            measurements.labels.some(size=>size<14)||
            measurements.actionHeight<48||measurements.columns!==expectedColumns) {
            throw Error('Workshop Customer form style mismatch: '+JSON.stringify({width:profile.width,...measurements}));
          }
          const nameInput=dialog.getByRole('textbox',{name:/Customer Name/}).first();
          await nameInput.focus();
          // This shell intentionally animates background-color for 150ms.
          // Sample settled focus/blur colors rather than mid-transition frames.
          await page.waitForTimeout(190);
          const focus=await nameInput.evaluate(input=>{
            const shell=input.closest('[data-cg-input-shell]');
            const focused=getComputedStyle(shell);
            const field=getComputedStyle(input);
            return {
              outline:focused.outlineStyle, border:parseFloat(focused.borderLeftWidth),
              shadow:focused.boxShadow, innerOutline:field.outlineStyle,
              innerBorder:parseFloat(field.borderLeftWidth),
              background:focused.backgroundColor,
            };
          });
          await nameInput.evaluate(input=>input.blur());
          await page.waitForTimeout(190);
          const idle=await nameInput.evaluate(input=>
            getComputedStyle(input.closest('[data-cg-input-shell]')).backgroundColor
          );
          if(focus.outline!=='none'||focus.border!==0||focus.shadow!=='none'||
             focus.innerOutline!=='none'||focus.innerBorder!==0||focus.background===idle){
            throw Error('Workshop Customer fields should be borderless with focus tint: '+JSON.stringify({focus,idle}));
          }
                    await dialog.getByRole('button',{name:'Close dialog'}).click();
          await dialog.waitFor({state:'hidden'});
        }
        // Real computed styles: legacy !important Job Card rules must not
        // shrink iPhone input fonts/labels after the CSS is bundled.
        if(/^\/jobs\/JOB-00251\/(overview|inspection|estimate|work)$/.test(path)){
          const metrics=await page.evaluate(()=>{
            const roots=[...document.querySelectorAll(
              '.cg-job-detail :is(.job-overview-simple,.cg-inspection,.job-quick-estimate,.job-work-simple)'
            )].filter(node=>node.getClientRects().length);
            const fields=roots.flatMap(root=>[...root.querySelectorAll(
              'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]),select,textarea'
            )].filter(node=>node.getClientRects().length).map(node=>({
              kind:node.tagName.toLowerCase(),
              font:parseFloat(getComputedStyle(node).fontSize),
              height:Math.round(node.getBoundingClientRect().height),
              nestedSearch:Boolean(node.closest('.job-quick-catalog-field,.cg-inspection-search')),
            })));
            const labels=roots.flatMap(root=>[...root.querySelectorAll('label')]
              .filter(node=>node.getClientRects().length)
              .map(node=>({
                size:parseFloat(getComputedStyle(node).fontSize),
                className:String(node.className||'').slice(0,90),
                labelText:(node.innerText||'').trim().slice(0,60),
              })));
            return {fields,labels};
          });
          const smallText=metrics.fields.filter(x=>x.font<16);
          const smallControls=metrics.fields.filter(x=>!x.nestedSearch &&
            x.kind!=='textarea' && x.height<44);
          const smallLabels=metrics.labels.filter(label=>label.size<14);
          if(smallText.length||smallControls.length||smallLabels.length)
            throw Error('Job Card forms should use 16px inputs, 14px+ labels, 44px+ controls: '+
              JSON.stringify({smallText,smallControls,smallLabels}));
        }
        // Work > Mechanic must be a real responsive grid, not naked
        // full-width controls. All API fixtures remain read-only.
        if(path==='/jobs/JOB-00251/work'){
          const addService = page.locator('.job-work-simple .job-service-quick');
          await addService.waitFor({state:'visible'});
          const serviceControls=await addService.evaluate(node=>{
            const inputs=[...node.querySelectorAll('input, select')].filter(el=>el.getClientRects().length);
            return {form:!!node.querySelector('.job-service-quick-entry'),
              inputMin:Math.min(...inputs.map(el=>parseFloat(getComputedStyle(el).fontSize))),
              minHeight:Math.min(...inputs.map(el=>el.getBoundingClientRect().height))};
          });
          // The standard browser fixture is a read-only Job Card. Mutation
          // fields are intentionally hidden until jobs.edit + Work stage is
          // active; the catalogue search remains accessible for inspection.
          if(serviceControls.inputMin<16 || serviceControls.minHeight<44)
            throw Error('Add Service catalogue controls are not touch friendly: '+JSON.stringify(serviceControls));
          // Timer is intentionally hidden behind Advanced Work Tracking.
          await page.getByRole('button',{name:'Advanced Work Tracking'}).click();
          const mechanic = page.locator('.job-work-simple .job-work-timer-panel');
          await mechanic.waitFor({state:'visible'});
          const layout=await mechanic.evaluate(node=>{
            const form=node.querySelector('.job-work-timer-form');
            const header=node.querySelector('.job-work-timer-head');
            const submit=form?.querySelector('button[type="submit"]');
            const label=form?.querySelector('label');
            const summary=node.querySelector('.job-work-timer-summary');
            const p=node.querySelector('.job-work-timer-hint');
            return {
              panelPadding:parseFloat(getComputedStyle(node).paddingLeft),
              headerDisplay:header&&getComputedStyle(header).display,
              formDisplay:form&&getComputedStyle(form).display,
              columns:form&&getComputedStyle(form).gridTemplateColumns.split(' ').length,
              labelDisplay:label&&getComputedStyle(label).display,
              buttonHeight:submit&&Math.round(submit.getBoundingClientRect().height),
              buttonFill:submit&&getComputedStyle(submit).backgroundColor,
              summaryDisplay:summary&&getComputedStyle(summary).display,
              hintPadding:p&&parseFloat(getComputedStyle(p).paddingLeft),
            };
          });
          const expectedCols=profile.width<=600?1:profile.width<=900?2:3;
          if(layout.formDisplay!=='grid'||layout.headerDisplay!=='flex'||
              layout.labelDisplay!=='flex'||layout.summaryDisplay!=='flex'||
              layout.panelPadding<12||layout.buttonHeight<44||
              layout.hintPadding<8||layout.columns!==expectedCols){
            throw Error('Mechanic form layout incomplete: '+JSON.stringify({width:profile.width,...layout}));
          }
        }
        if(path==='/stock' && [390,1440].includes(profile.width)) {
          // Use real browser computed styles for Stock Add New Product
          // and verify the new Supplier receiving route. No POSTs are made.
          await page.getByRole('button',{name:'Add New Part'}).first().click();
          const addDialog=page.getByRole('dialog',{name:'Add New Part'});
          await addDialog.waitFor();
          const search=await addDialog.locator('.cg-easy-picker-search').evaluate(node=>{
            const input=node.querySelector('input');
            const field=getComputedStyle(input),shell=getComputedStyle(node);
            return {
              shellHeight:Math.round(node.getBoundingClientRect().height),
              font:parseFloat(field.fontSize), inputBorder:parseFloat(field.borderLeftWidth),
              inputOutline:field.outlineStyle, inputShadow:field.boxShadow,
              shellBorder:parseFloat(shell.borderLeftWidth), shellOutline:shell.outlineStyle,
              shellShadow:shell.boxShadow, focusedBackground:shell.backgroundColor,
            };
          });
          const stockIdle=await addDialog.locator('.cg-easy-picker-search').evaluate(node=>{
            node.querySelector('input').blur();
            return getComputedStyle(node).backgroundColor;
          });
          if(search.shellHeight<48||search.font<16||search.inputBorder!==0||
             search.inputOutline!=='none'||search.inputShadow!=='none'||
             search.shellBorder!==0||search.shellOutline!=='none'||
             search.shellShadow!=='none'||search.focusedBackground===stockIdle){
            throw Error('Stock search has nested borders or no focus tint: '+JSON.stringify({search,stockIdle}));
          }
                    await addDialog.getByRole('button',{name:'Add as New Product'}).click();
          const partStyles=await addDialog.locator('form.cg-easy-form').evaluate(form=>{
            const inputs=[...form.querySelectorAll('input:not([type=radio]),select')]
              .filter(node=>node.getClientRects().length)
              .map(node=>({
                font:parseFloat(getComputedStyle(node).fontSize),
                height:Math.round(node.getBoundingClientRect().height),
              }));
            const labels=[...form.querySelectorAll('label')]
              .filter(node=>node.getClientRects().length)
              .map(node=>parseFloat(getComputedStyle(node).fontSize));
            const grid=form.querySelector('.cg-easy-fields');
            const columns=grid?getComputedStyle(grid).gridTemplateColumns.split(' ').length:0;
            return {inputs,labels,columns};
          });
          const columnCount=profile.width<=520?1:2;
          if(partStyles.inputs.some(x=>x.font<16||x.height<48)||
              partStyles.labels.some(x=>x<14)||partStyles.columns!==columnCount) {
            throw Error('Stock Add Product form UI mismatch: '+JSON.stringify({width:profile.width,...partStyles}));
          }
          await addDialog.getByRole('button',{name:'Close dialog'}).click();
          const supplierReceiving=page.getByRole('link',{name:'Buy / Receive from Supplier'});
          await supplierReceiving.waitFor({state:'visible'});
          if (await supplierReceiving.getAttribute('href') !== '/suppliers') {
            throw Error('Purchased stock must route to Supplier details workflow');
          }
          if(await page.getByRole('button',{name:'Receive Stock',exact:true}).count()) {
            throw Error('Obsolete unlinked Receive Stock button must not reappear');
          }
        }
        if(path==='/login'){
          // Regression for double red outline: the outer div owns the border,
          // even when both nested inputs are aria-invalid and focused.
          await page.locator('.login-input-shell').first().waitFor();
          await page.locator('.login-submit').click();
          await page.waitForFunction(()=>document.querySelectorAll('.login-input-shell.is-error').length===2);
          const styles=await page.locator('.login-input-shell').evaluateAll(nodes=>nodes.map(shell=>{
            const wrapper=getComputedStyle(shell);
            const input=getComputedStyle(shell.querySelector('input.login-input'));
            return {
              shellBorder:parseFloat(wrapper.borderTopWidth),
              innerBorder:parseFloat(input.borderTopWidth),
              innerOutline:input.outlineStyle,
              innerShadow:input.boxShadow,
              shellColor:wrapper.borderTopColor,
            };
          }));
          if(styles.length!==2 || styles.some(s=>s.shellBorder!==1 ||
            s.innerBorder!==0 || s.innerOutline!=='none' || s.innerShadow!=='none')) {
            throw Error('Login email/password has a second inner border/outline: '+JSON.stringify(styles));
          }
        }

        if(profile.width < 1024) {
          const wallet=page.locator('.mobile-header-actions > .cg-credit-chip');
          if(await wallet.count()) {
            const broken=await wallet.evaluate(node=>{
              const icon=node.querySelector('svg').getBoundingClientRect();
              const value=node.querySelector('.cg-credit-chip-mobile').getBoundingClientRect();
              return node.scrollWidth > node.clientWidth + 1 || Math.abs((icon.top+icon.height/2)-(value.top+value.height/2)) > 8;
            });
            if(broken) throw Error('Wallet balance wraps or overflows');
          }
        }
        if(path==='/invoices/INV-0001' && profile.width<=430) {
          await page.getByRole('button',{name:'Download Invoice PDF'}).click();
          const sheet=page.getByRole('dialog',{name:'Share invoice PDF'});
          await sheet.waitFor();
          await sheet.getByRole('button',{name:'Download PDF'}).waitFor({state:'visible'});
          await page.waitForFunction(()=>{
            const download=document.querySelector('.invoice-pdf-share-download');
            return download && !download.disabled;
          });
          const position=await sheet.evaluate(node=>{
            const rect=node.querySelector('.responsive-modal-sheet')?.getBoundingClientRect();
            return {bottom:rect?.bottom,viewport:window.innerHeight};
          });
          if(Math.abs(position.viewport-position.bottom)>2) {
            throw Error('Invoice PDF bottom sheet does not align to phone bottom: '+JSON.stringify(position));
          }
          await sheet.getByRole('button',{name:'Cancel'}).click();
          await sheet.waitFor({state:'hidden'});
        }

        if(path==='/invoices/e-way-bills/EWB-001' && profile.width===390) {
          const open = page.getByRole('button',{name:'Download PDF'}).first();
          await open.click();
          const modal = page.getByRole('dialog',{name:'Share E-Way Bill PDF'});
          await modal.waitFor();
          const download = modal.getByRole('button',{name:'Download PDF'});
          await page.waitForFunction(() =>
            !!document.querySelector('.invoice-pdf-share-download:not(:disabled)'));
          if(await download.isDisabled()) throw Error('Saved E-Way PDF did not become downloadable.');
          const bounds=await modal.evaluate(node=>{
            const sheet=node.querySelector('.responsive-modal-sheet')?.getBoundingClientRect();
            return {bottom:sheet?.bottom,viewport:innerHeight};
          });
          if(Math.abs(bounds.bottom-bounds.viewport)>3){
            throw Error('E-Way PDF share sheet not attached to phone bottom: '+JSON.stringify(bounds));
          }
          await modal.getByRole('button',{name:'Cancel'}).click();
          await modal.waitFor({state:'hidden'});
        }

        if(path==='/invoices/e-way-bills/new' && profile.width===390) {
          const to=page.locator('section').filter({has:page.getByText('SECTION 2 · TO',{exact:true})});
          const toGstin=to.getByPlaceholder('GSTIN / URP');
          const toState=to.getByRole('combobox',{name:'TO State Code'});
          const taxRate=page.getByRole('combobox',{name:'GST rate'}).first();
          await taxRate.waitFor();
          if(await taxRate.isDisabled()) throw Error('GST rate must be selectable before TO state.');
          await page.locator('.eway-goods-fields').getByPlaceholder('0.00').first().fill('100');
          await taxRate.selectOption('igst:18');
          if(await taxRate.inputValue()!=='igst:18') throw Error('IGST 18% choice was lost before state selection.');
          await toGstin.fill('33ABCDE1234F1Z5');
          if(await toState.inputValue()!=='33' || !(await toState.isDisabled())) {
            throw Error('TO State Code was not auto-filled and locked from Tamil Nadu GSTIN.');
          }
          await page.waitForFunction(() => [...document.querySelectorAll('.eway-goods-totals > div')]
            .some(node => node.innerText.includes('IGST') && node.innerText.includes('₹18.00')));
          await toGstin.fill('URP');
          if(await toState.isDisabled()) throw Error('URP recipient must allow manual State selection.');
          await toState.selectOption('32');
          // After crossing back to the supplier state the legal tax is CGST + SGST.
          await taxRate.selectOption('cgst:9');
          await page.waitForFunction(() => {
            const rows = [...document.querySelectorAll('.eway-goods-totals > div')];
            return rows.some(node => node.innerText.includes('CGST') && node.innerText.includes('₹9.00')) &&
              rows.some(node => node.innerText.includes('SGST') && node.innerText.includes('₹9.00'));
          });
          if(await taxRate.inputValue()!=='cgst:9') throw Error('CGST 9% was not selected for intra-state supply.');
        }

        if(path==='/invoices/e-way-bills/new' && profile.width===390) {
          await page.locator('[data-eway-field="from.gstin"]').waitFor();
          await page.waitForFunction(() => document.querySelector('[data-eway-field="from.gstin"]')?.value === '32ABCDE1234F1Z5');
          await page.getByRole('button',{name:'Prepare for API'}).click();
          const invalid=page.locator('[data-eway-field="documentNo"]');
          await page.waitForFunction(() => document.activeElement?.getAttribute('data-eway-field') === 'documentNo');
          if(await invalid.getAttribute('aria-invalid')!=='true'){
            throw Error('E-Way Bill should highlight first missing field');
          }
          await invalid.fill('INV-TEST-001');
          if(await invalid.getAttribute('aria-invalid')==='true'){
            throw Error('E-Way Bill error did not clear after correcting input');
          }
          if(await page.locator('.eway-gst-explanation,.eway-gst-breakdown').count()){
            throw Error('Removed GST explanation still rendered');
          }
        }

        if(path==='/dashboard') {
          const dimensions = await page.evaluate(() => {
            const top = document.querySelector('.dashboard-top-actions');
            const stats = document.querySelector('.dashboard-stats');
            const quick = document.querySelector('.dashboard-top-actions .quick-actions button');
            const finance = document.querySelector('.finance-list > div');
            const staff = document.querySelector('.staff-copy strong');
            const progress = document.querySelector('.overall-progress [role="progressbar"]');
            const width = document.documentElement.scrollWidth;
            const size = node => node ? parseFloat(getComputedStyle(node).fontSize) : null;
            return {
              topY: top?.getBoundingClientRect().top,
              statsY: stats?.getBoundingClientRect().top,
              quickFont: size(quick), financeFont: size(finance),
              staffFont: size(staff), progressWidth: progress?.getAttribute('aria-valuenow'),
              contentWidth: width,
            };
          });
          if(!(dimensions.topY < dimensions.statsY)){
            throw Error('Quick Actions does not appear above stats: '+JSON.stringify(dimensions));
          }
          for(const name of ['quickFont','financeFont','staffFont']){
            if(dimensions[name] != null && dimensions[name]<14){
              throw Error('Unreadable Dashboard '+name+': '+JSON.stringify(dimensions));
            }
          }
          if(dimensions.contentWidth>profile.width+2){
            throw Error('Dashboard overflows viewport: '+JSON.stringify(dimensions));
          }
          if(dimensions.progressWidth==='70'){
            throw Error('Overall Job Progress is still hardcoded to 70%');
          }
        }

        if(path==='/my-attendance/calendar') {
          const punch = page.locator('.attendance-punch-card');
          await punch.waitFor();
          const measured = await punch.evaluate(node => {
            const status = node.querySelector('.attendance-punch-status strong');
            const note = node.querySelector('.attendance-punch-note span');
            return {
              statusFont: status ? parseFloat(getComputedStyle(status).fontSize) : null,
              noteFont: note ? parseFloat(getComputedStyle(note).fontSize) : null,
              width: node.getBoundingClientRect().width,
            };
          });
          if (measured.statusFont != null && measured.statusFont < 16) {
            throw Error('My Attendance status too small: ' + JSON.stringify(measured));
          }
          if (measured.noteFont != null && measured.noteFont < 14) {
            throw Error('My Attendance completion note too small: ' + JSON.stringify(measured));
          }
          if (measured.width > profile.width + 2) {
            throw Error('My Attendance punch card overflows viewport: ' + JSON.stringify(measured));
          }
        }
        if(path==='/my-attendance/leave' && (profile.width === 390 || profile.width === 1440)) {
          await page.getByRole('button', { name: 'Apply Leave' }).click();
          const dialog = page.getByRole('dialog', { name: 'Apply for Leave' });
          await dialog.waitFor();
          const date = dialog.locator('input[type="date"]');
          const expected = await page.evaluate(() => {
            const d = new Date();
            return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'),
              String(d.getDate()).padStart(2,'0')].join('-');
          });
          if(await date.inputValue() !== expected) {
            throw Error('Leave Date not auto-filled to local today.');
          }
          const font = await date.evaluate(node => parseFloat(getComputedStyle(node).fontSize));
          if(font < 16) throw Error('Leave Date input font below 16px: '+font);
          if(await dialog.getByText('All leave is unpaid.').count()) {
            throw Error('Old unpaid wage explanation still shown.');
          }
          await date.fill('2026-11-04');
          await dialog.getByRole('button', { name: 'Cancel' }).click();
          await dialog.waitFor({ state: 'hidden' });
          await page.getByRole('button', { name: 'Apply Leave' }).click();
          await date.waitFor();
          if(await date.inputValue() !== expected) {
            throw Error('Leave Date did not reset to today on reopening.');
          }
          await dialog.getByRole('button', { name: 'Cancel' }).click();
        }

        if(path==='/attendance-manager/leave-requests') {
          const blockedCard = page.locator('.am-approval-card').filter({hasText:'Logged In Owner'});
          await blockedCard.waitFor();
          await blockedCard.getByText('Your own request must be reviewed by another authorized manager.').waitFor();
          if(await blockedCard.getByRole('button',{name:'Approve'}).count()!==0) {
            throw Error('Own leave request still displays Approve action.');
          }
          if(await blockedCard.getByRole('button',{name:'Reject'}).count()!==0) {
            throw Error('Own leave request still displays Reject action.');
          }
          const other = page.locator('.am-approval-card').filter({hasText:'Belle Trujillo'});
          if(await other.getByRole('button',{name:'Approve'}).count()!==1) {
            throw Error('Another employee leave request lost approval action.');
          }
        }

        if(path.startsWith('/attendance-manager/') && [
          'overview','daily','calendar','leave-requests','shifts','reports','rules'
        ].includes(path.split('/')[2])) {
          const metrics = await page.evaluate(() => {
            const root = document.querySelector('.cg-attendance-manager');
            if (!root) return { missing: true };
            const font = selector => {
              const element = root.querySelector(selector);
              return element ? parseFloat(getComputedStyle(element).fontSize) : null;
            };
            const size = selector => {
              const element = root.querySelector(selector);
              return element ? Math.round(element.getBoundingClientRect().height) : null;
            };
            return {
              tab: font('.attendance-manager-dashboard-tabs button'),
              dailyWages: font('.attendance-manager-header-actions .dw-button'),
              rulesBadge: font('.attendance-manager-header-badge'),
              header: font('.am-section-header h2,.am-calendar-header h2,.am-daily-heading h2,.attendance-rules-header h2'),
              label: font('.am-approval-details strong,.am-table-card td,.am-dashboard-stat-top span,.am-shift-list strong,.am-report-filter label > span,.attendance-mode-copy .am-mode-description'),
              leaveButton: font('.am-approval-actions > button'),
              leaveButtonHeight: size('.am-approval-actions > button'),
              field: font('.am-daily-date input,.am-calendar-month-controls select,.am-shift-form input,.am-report-filter select,.attendance-rule-field input'),
              mainWidth: document.documentElement.scrollWidth,
              viewport: window.innerWidth,
            };
          });
          if(metrics.missing) throw Error('Attendance Manager route missing shared layout: '+path);
          for (const field of ['tab','dailyWages','rulesBadge','label','leaveButton']) {
            if(metrics[field]!==null && metrics[field]<13.5) {
              throw Error('Unreadable Attendance Manager '+field+' on '+path+': '+JSON.stringify(metrics));
            }
          }
          if(metrics.header!==null && metrics.header<16.5) {
            throw Error('Attendance Manager heading below readable minimum on '+path+': '+JSON.stringify(metrics));
          }
          if(metrics.field!==null && metrics.field<15.5) {
            throw Error('Attendance Manager form field below 16px on '+path+': '+JSON.stringify(metrics));
          }
          if(metrics.leaveButtonHeight!==null && metrics.leaveButtonHeight<44) {
            throw Error('Leave approval button below 44px: '+JSON.stringify(metrics));
          }
          if(metrics.mainWidth>metrics.viewport+2) {
            throw Error('Attendance Manager horizontal page overflow on '+path+': '+JSON.stringify(metrics));
          }
        }

        if ([
          '/staff-management/overview',
          '/staff-management/staff',
          '/staff-management/roles',
          '/staff-management/teams',
          '/staff-management/shifts',
        ].includes(path)) {
          const measured = await page.evaluate(() => {
            const root = document.querySelector('.cg-staff-management');
            const font = selector => {
              const element = root?.querySelector(selector);
              return element ? parseFloat(getComputedStyle(element).fontSize) : null;
            };
            const height = selector => {
              const element = root?.querySelector(selector);
              return element ? element.getBoundingClientRect().height : null;
            };
            return {
              tabs: font('.staff-dashboard-tab span'),
              heading: font('.staff-overview-page-heading h1,.staff-dashboard-header h1'),
              label: font('.staff-simple-metrics span,.staff-directory-details span,.roles-dashboard-card-meta span,.staff-team-card__meta,.staff-crud-detail-grid strong'),
              person: font('.staff-simple-person-details strong,.staff-directory-person strong,.roles-dashboard-card-title strong,.staff-team-card__head h3,.staff-crud-card__head h3'),
              button: font('.staff-simple-toolbar-actions button,.staff-add-button,.roles-primary-button,.staff-team-assign-button,.staff-crud-actions button'),
              touch: height('.staff-simple-toolbar-actions button,.staff-add-button,.roles-primary-button,.staff-team-assign-button,.staff-crud-actions button'),
              input: font('.staff-simple-search input,.staff-directory-search input,.roles-dashboard input'),
              overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
            };
          });
          for (const [key, min] of Object.entries({tabs:13.5,heading:22,label:13.5,person:14.5,button:13.5,input:15.5})) {
            if (measured[key] !== null && measured[key] < min) {
              throw Error('Staff Management unreadable '+key+' on '+path+': '+JSON.stringify(measured));
            }
          }
          if(measured.touch!==null && measured.touch < 43.5) {
            throw Error('Staff Management small touch target on '+path+': '+JSON.stringify(measured));
          }
          if(measured.overflow) {
            throw Error('Staff Management horizontal page overflow on '+path+': '+JSON.stringify(measured));
          }
        }

        if(path==='/staff-management/staff') {
          const card=page.locator('.staff-directory-card').first();
          await card.waitFor();
          const stats=await card.evaluate(node => {
            const facts=[...node.querySelectorAll('.staff-directory-fact')];
            const actions=[...node.querySelectorAll('.staff-directory-card__actions button')];
            const sizes=actions.map(b=>({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}));
            const rect=node.getBoundingClientRect();
            const minFont=Math.min(...facts.flatMap(f=>[
              ...f.querySelectorAll('.staff-directory-fact__copy > span')
            ]).map(el=>parseFloat(getComputedStyle(el).fontSize)));
            const clipped=facts.some(f=>f.scrollWidth>f.clientWidth+2);
            return {font:minFont,actions:sizes,clipped,
              cardWidth:rect.width,viewport:innerWidth,
              pageOverflow:document.documentElement.scrollWidth>innerWidth+2,
              detailColumns:getComputedStyle(node.querySelector('.staff-directory-details')).gridTemplateColumns,
            };
          });
          if(stats.font<13.5 || stats.clipped || stats.pageOverflow) {
            throw Error('Staff Directory card text unreadable or clipped: '+JSON.stringify(stats));
          }
          if(stats.actions.some(b=>b.h<43.5 || b.w<43.5)) {
            throw Error('Staff Directory card touch button below 44px: '+JSON.stringify(stats));
          }
          if(stats.cardWidth<305 && stats.detailColumns.split(' ').length!==1) {
            throw Error('Narrow Staff card facts are not stacked: '+JSON.stringify(stats));
          }
          const power=card.locator('.staff-status-button');
          if(await power.count() && !(await power.getAttribute('aria-label'))) {
            throw Error('Staff account status icon lacks accessible label.');
          }
        }

        if ([
          '/payroll/daily-wages',
          '/payroll/daily-wages/history',
          '/payroll/payments',
        ].includes(path)) {
          const metrics = await page.evaluate(() => {
            const root = document.querySelector('.dw-page');
            const font = selector => {
              const el = root?.querySelector(selector);
              return el ? parseFloat(getComputedStyle(el).fontSize) : null;
            };
            const height = selector => {
              const el = root?.querySelector(selector);
              return el ? el.getBoundingClientRect().height : null;
            };
            return {
              heading: font('.dw-header h1'), subtitle: font('.dw-header p'),
              nav: font('.dw-nav a'), cardTitle: font('.dw-card-head h2'),
              count: font('.dw-card-head > span'),
              table: font('.dw-table tbody td'), tableLabel: font('.dw-table tbody td::before'),
              input: font('.dw-search input'), select: font('.dw-toolbar select'),
              actionHeight: height('.dw-button'),
              navHeight: height('.dw-nav a'),
              pageOverflow: document.documentElement.scrollWidth > innerWidth+2,
              scrollArea: !!root?.querySelector('.dw-table-scroll'),
              bodyRows: root?.querySelectorAll('.dw-table tbody tr').length || 0,
            };
          });
          for(const [key,min] of Object.entries({
            heading:21.5,subtitle:13.5,nav:13.5,cardTitle:18.5,
            count:13.5,table:13.5,input:15.5,select:15.5,
          })) {
            if(metrics[key]!==null && metrics[key]<min) {
              throw Error('Payroll unreadable '+key+' '+path+': '+JSON.stringify(metrics));
            }
          }
          if(metrics.pageOverflow || metrics.actionHeight<43.5 || metrics.navHeight<43.5) {
            throw Error('Payroll overflow or tiny button '+path+': '+JSON.stringify(metrics));
          }
          if(!metrics.scrollArea || !metrics.bodyRows) {
            throw Error('Payroll fixture data table not rendered '+path+': '+JSON.stringify(metrics));
          }
        }

        if(path==='/vehicles' || /^\/vehicles\/[^/]+$/.test(path)) {
          // Vehicle details fetches customer and service history asynchronously.
          // Avoid reading the loading placeholder before profile content appears.
          await page.locator('.cg-vehicles').waitFor({state:'visible',timeout:12000});
          const metrics = await page.evaluate(() => {
            const root=document.querySelector('.cg-vehicles');
            const font = selector => {
              const el=root?.querySelector(selector);
              return el ? parseFloat(getComputedStyle(el).fontSize) : null;
            };
            const height = selector => {
              const el=root?.querySelector(selector);
              return el ? el.getBoundingClientRect().height : null;
            };
            const input=root?.querySelector('.vehicle-dashboard-search input');
            const border = input ? getComputedStyle(input).borderTopWidth : null;
            return {
              missing:!root,
              listHeading:font('.vehicle-dashboard-header h1'),
              listLabel:font('.vehicle-dashboard-stat-top span'),
              listSearch:font('.vehicle-dashboard-search input'),
              searchBorder:border,
              profileTitle:font('.vehicle-profile-header h1'),
              profileLabel:font('.vehicle-profile-kpis span'),
              profileValue:font('.vehicle-info-card strong'),
              tab:font('.vehicle-profile-tabs button'),
              actionHeight:height('.vehicle-profile-actions button,.vehicle-primary-button'),
              pageOverflow:document.documentElement.scrollWidth>innerWidth+2,
            };
          });
          if(metrics.missing || metrics.pageOverflow) {
            throw Error('Vehicle page overflow or missing root '+path+': '+JSON.stringify(metrics));
          }
          for(const [key,min] of Object.entries({
            listHeading:22,listLabel:13.5,listSearch:15.5,
            profileTitle:22,profileLabel:13.5,profileValue:14.5,tab:13.5,
          })) {
            if(metrics[key]!==null && metrics[key]<min) {
              throw Error('Vehicle font too small '+key+' on '+path+': '+JSON.stringify(metrics));
            }
          }
          if(metrics.searchBorder!==null && metrics.searchBorder!=='0px') {
            throw Error('Vehicle search has double border: '+JSON.stringify(metrics));
          }
          if(metrics.actionHeight!==null && metrics.actionHeight<43.5) {
            throw Error('Vehicle action too small: '+JSON.stringify(metrics));
          }
        }

        if(path==='/staff-management/overview') {
          const input=page.locator('.staff-simple-search input');
          const border=await input.evaluate(node=>getComputedStyle(node).borderTopWidth);
          if(border !== '0px') throw Error('Nested staff search border: '+border);
          await page.getByText('Ajmal K', {exact:true}).waitFor();
        }
        if(path==='/settings' && profile.width<=760){
          await page.getByRole('heading',{name:'Settings',exact:true}).waitFor({state:'visible'});
          const gap=await page.evaluate(()=>{
            const heading=document.querySelector('.settings-dashboard-heading');
            const actions=document.querySelector('.settings-dashboard-header-actions');
            const last=heading?.lastElementChild;
            return last&&actions?actions.getBoundingClientRect().top-last.getBoundingClientRect().bottom:Infinity;
          });
          if(gap>40)throw Error('Excess blank space below Settings heading: '+gap);
          const fixedBases=await page.evaluate(()=>[...document.querySelectorAll('.settings-dashboard-header,.settings-theme,.settings-footer')]
            .filter(node=>getComputedStyle(node).flexDirection.startsWith('column'))
            .flatMap(node=>[...node.children].filter(child=>parseFloat(getComputedStyle(child).flexBasis)>80).map(child=>child.className)));
          if(fixedBases.length)throw Error('Desktop flex basis used as mobile height: '+fixedBases.join(','));
        }
        if(path==='/staff-management/roles'){
          await page.getByRole('button',{name:/Add New Role|Add Role/}).click();
          const dialog=page.getByRole('dialog');
          await dialog.waitFor();
          const width=await dialog.evaluate(node=>node.getBoundingClientRect().width);
          if(width>profile.width+2)throw Error('Role dialog wider than viewport');
          const sizes=await dialog.locator('input:not([type=checkbox]),select,textarea').evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length).map(e=>parseFloat(getComputedStyle(e).fontSize)));
          if(sizes.some(size=>size<16))throw Error('Role dialog form text below 16px');
          await page.keyboard.press('Escape');
        }
        if(process.env.UI_SCREENSHOTS){
          await page.screenshot({path:join(artifacts,`${profile.width}-${profile.theme}-${path.replace(/\W+/g,'-')}.png`),timeout:5000});
        }
        tested++;
      } catch(error) {
        firstNavigation=true;
        const name=`${profile.width}-${profile.theme}-${path.replace(/\W+/g,'-')}`;
        failures.push(`${profile.width}/${profile.theme} ${path} (at ${page.url()}): ${error.message}`);
        console.error(failures.at(-1));
        await page.screenshot({path:join(artifacts,name+'.png'),timeout:2000}).catch(()=>{});
      }
    }
    let themeStep='open settings';
    try {
      await page.goto(baseURL+'/settings',{waitUntil:'networkidle',timeout:15000});
      await page.locator('.route-loading').waitFor({state:'hidden',timeout:15000});
      const appearance=page.getByLabel('Appearance');
      const alternateTheme=profile.theme==='dark'?'light':'dark';
      themeStep='apply alternate theme';
      await appearance.selectOption(alternateTheme);
      await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,alternateTheme);
      themeStep='check persisted theme';
      if(await page.evaluate(()=>localStorage.getItem('cubegears-theme'))!==alternateTheme) throw Error('Theme preference was not persisted');
      themeStep='reload saved theme';
      await page.reload({waitUntil:'networkidle'});
      await page.locator('.route-loading').waitFor({state:'hidden',timeout:15000});
      await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,alternateTheme);
      if(await page.getByLabel('Appearance').inputValue()!==alternateTheme) throw Error('Saved theme was not restored after reload');
      themeStep='restore starting theme';
      await page.getByLabel('Appearance').selectOption(profile.theme);
      await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,profile.theme);
      tested++;
    } catch(error) {
      const themeState=await page.evaluate(()=>({theme:document.documentElement.dataset.theme,saved:localStorage.getItem('cubegears-theme'),path:location.pathname,selected:document.querySelector('[aria-label="Appearance"]')?.value}));
      failures.push(`${profile.width}/${profile.theme} Settings theme switch (${themeStep}): ${error.message}; state=${JSON.stringify(themeState)}`);
      console.error(failures.at(-1));
    }
    await context.close();
    console.log(`Checked ${paths.length} routes at ${profile.width}px (${profile.theme})`);
  }));
  if(failures.length){console.error(failures.join('\n'));throw Error(`${failures.length} UI checks failed; screenshots: ${artifacts}`);}
  console.log(`PASS ${tested} page checks: ${paths.length} routes, ${profiles.length} viewport/theme profiles. API responses are test fixtures.`);
} finally {await browser?.close();server.kill();}
