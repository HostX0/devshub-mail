import { ADMIN_PAGES, type AdminPageId } from './admin-nav';

const pages: Record<AdminPageId, readonly [string, string]> = {
  dashboard: ['نظرة عامة', 'حالة نظام البريد والعناصر التي تحتاج إلى متابعة'],
  mailboxes: ['بريد الموظفين', 'حسابات بريد الموظفين وكلمات المرور وحدود التخزين'],
  settings: ['الخادم', 'إعدادات الاتصال بالخادم وخيارات صفحة تسجيل الدخول'],
  auth: ['المصادقة', 'الدخول الموحّد وصلاحيات الإدارة وأمان الجلسات'],
  branding: ['هوية الشركة', 'الشعارات والألوان ومعلومات الشركة، مع تخصيصها لكل نطاق عند الحاجة'],
  policy: ['الميزات والإعدادات', 'تحديد الميزات والإعدادات المتاحة والقيم الافتراضية لجميع المستخدمين أو لنطاق أو مجموعة محددة'],
  organisation: ['النطاقات والمجموعات', 'تخصيص إعدادات النطاقات والمجموعات ومراجعة السياسة المطبّقة على كل مستخدم وحفظها في ملف واحد'],
  'org-signatures': ['التوقيعات', 'التوقيع وإخلاء المسؤولية المرفقان بكل رسالة'],
  'org-templates': ['القوالب', 'القوالب المتاحة للجميع وما يمكن للمستخدمين إضافته من قوالب خاصة'],
  'org-security': ['الأمان', 'تنبيهات البريد الخارجي وبلاغات التصيّد ومدة الجلسات والاتصالات الخارجية'],
  'org-sharing': ['المشاركة', 'وسوم البريد المشترك والتفويض واستعادة العناصر المحذوفة'],
  'org-labels': ['التصنيف', 'تصنيفات يختارها المستخدم عند كتابة الرسالة، مثل داخلي أو سري، وترافق الرسالة'],
  'org-proofreading': ['التدقيق اللغوي', 'التدقيق الإملائي والنحوي أثناء الكتابة: إلزامي أو معطّل أو حسب اختيار المستخدم'],
  'org-calendars': ['التقويمات', 'تقويمات الشركة ومشاركة أوقات التفرّغ وإظهار الغياب في التقويم'],
  'org-notices': ['الإعلانات', 'الإعلانات داخل التطبيقات ومدة الاحتفاظ بالبريد في المهملات والبريد المزعج'],
  'org-devices': ['الأجهزة', 'ما يمكن للمستخدمين تنزيله أو طباعته أو حفظه على أجهزتهم'],
  plugins: ['الإضافات', 'الإضافات المثبتة لجميع المستخدمين وما يُسمح لهم بتثبيته بأنفسهم'],
  themes: ['المظاهر', 'المظاهر المثبتة والقيم الافتراضية وخيارات المستخدمين'],
  marketplace: ['متجر الإضافات', 'الإضافات والمظاهر المتاحة في الدليل'],
  version: ['التحديثات', 'الإصدار الحالي والتحقق من التحديثات كل ساعة'],
  telemetry: ['إحصاءات الاستخدام', 'إحصاءات يومية مجهولة الهوية، معطّلة حتى تختار تفعيلها'],
  monitoring: ['المراقبة', 'تقارير الأخطاء والمقاييس وفحوص الحالة وتتبع الطلبات باستخدام أدواتك'],
  logs: ['سجل العمليات', 'من أجرى التغييرات في لوحة الإدارة ومتى'],
};
const sections: Record<string, string> = {
  'General':'عام', 'Login page':'صفحة تسجيل الدخول', 'JMAP servers':'خوادم JMAP', 'Document editing':'تحرير المستندات', 'Brand logos':'شعارات المرسلين', 'Logging':'تسجيل الأحداث', 'Settings sync':'مزامنة الإعدادات', 'OAuth / OpenID Connect':'الاتصال عبر OAuth / OpenID Connect', 'Single sign-on':'الدخول الموحّد', 'Admin access':'دخول الإدارة', 'Session and security':'الجلسات والأمان', 'Scope':'النطاق المستهدف', 'Images and logos':'الصور والشعارات', 'Progressive web app':'تطبيق الويب القابل للتثبيت', 'Company information':'معلومات الشركة', 'Features':'الميزات', 'Push relays':'خوادم تمرير الإشعارات', 'Recipient directory':'دليل المستلمين', 'Default sidebar apps':'تطبيقات الشريط الجانبي الافتراضية', 'Locked settings':'الإعدادات المقفلة', 'Domains and groups':'النطاقات والمجموعات', 'Effective policy':'السياسة المطبّقة', 'Policy file':'ملف السياسة', 'Signature':'التوقيع', 'User details':'تفاصيل المستخدم', 'Disclaimer':'إخلاء المسؤولية', 'Organisation library':'مكتبة الشركة', 'Personal and team templates':'القوالب الشخصية وقوالب الفريق', 'Out-of-office replies':'ردود الغياب', 'External mail':'البريد الخارجي', 'Phishing reports':'بلاغات التصيّد', 'Sessions':'الجلسات', 'Third-party traffic':'الاتصال بخدمات خارجية', 'Shared tags':'الوسوم المشتركة', 'Delegates':'المفوّضون', 'Recover deleted items':'استعادة العناصر المحذوفة', 'Classification labels':'تصنيفات الرسائل', 'Proofreading':'التدقيق اللغوي', 'Company calendars':'تقويمات الشركة', 'Free/busy sharing':'مشاركة أوقات التفرّغ', 'Out-of-office':'خارج المكتب', 'Announcement':'الإعلان', 'Trash and Junk':'المهملات والبريد المزعج', 'Downloads, printing and notifications':'التنزيلات والطباعة والإشعارات', 'Offline mode':'العمل دون اتصال', 'Registered devices':'الأجهزة المسجلة', 'Plugins for users':'إضافات المستخدمين', 'Approval requests':'طلبات الموافقة', 'Installed plugins':'الإضافات المثبتة', 'Installed themes':'المظاهر المثبتة', 'Theme policy':'سياسة المظاهر', 'Offered to users':'المتاح للمستخدمين', 'Status':'الحالة', 'Schedule':'الجدول', 'Source':'المصدر', 'Account activity':'نشاط الحسابات', 'Endpoint':'عنوان الخدمة', 'Payload preview':'معاينة البيانات', 'Error reporting':'تقارير الأخطاء', 'Errors today':'أخطاء اليوم', 'Metrics':'المقاييس', 'Health checks':'فحوص الحالة', 'Tracing':'تتبع الطلبات',
};
const arabicPages = ADMIN_PAGES.map(page => ({ ...page, label: pages[page.id][0], description: pages[page.id][1], sections: page.sections.map(section => ({ ...section, title: sections[section.title] ?? section.title })) }));
const arabicCopy = new Map<string, string>(ADMIN_PAGES.flatMap(page => [[page.label, pages[page.id][0]], [page.description, pages[page.id][1]]] as [string, string][]));
export function localizedAdminPages(isArabic: boolean) { return isArabic ? arabicPages : ADMIN_PAGES; }
export function localizeAdminMetadata(text: string, isArabic: boolean) { return isArabic ? arabicCopy.get(text) ?? sections[text] ?? text : text; }
