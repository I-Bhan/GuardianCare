# GuardianCare

منصة لمتابعة المرضى تجمع بين كشف السقوط بالفيديو وقراءات المؤشرات الحيوية. تعرض لوحة المتابعة آخر قراءة لكل مريض، واتجاه المؤشرات، وسجل الحوادث. يستخدم المشروع SQLite للمرضى والقراءات والحوادث، وSupabase لتسجيل الدخول والملفات الشخصية وتعيينات مقدّمي الرعاية.

## تشغيل النسخة الموجودة على جهازك

افتح نافذتي PowerShell. في النافذة الأولى شغّل الـAPI باستخدام مفسّر المشروع حتى يستخدم مكتبات النماذج المثبتة معه.

```powershell
cd "$env:USERPROFILE\Projects\GuardianCare"
.\.venv\Scripts\python.exe -m uvicorn guardiancare_api.main:app --host 127.0.0.1 --port 8001
```

انتظر ظهور `Application startup complete`. أثناء تطوير كود Python يمكنك إضافة `--reload` إلى الأمر.

في النافذة الثانية شغّل الموقع.

```powershell
cd "$env:USERPROFILE\Projects\GuardianCare\frontend"
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

| ما تريد فتحه | الرابط على اللابتوب |
|---|---|
| الموقع وتسجيل الدخول | [GuardianCare](http://127.0.0.1:5173/) |
| لوحة المرضى | [Dashboard](http://127.0.0.1:5173/dashboard) |
| حالة الخادم | [Health](http://127.0.0.1:8001/health) |
| توثيق الطلبات والنماذج | [API docs](http://127.0.0.1:8001/docs) |

اترك النافذتين مفتوحتين أثناء الاستخدام. لإيقاف أي خدمة اضغط `Ctrl+C` في نافذتها. المنفذ `8001` مخصّص لـGuardianCare في هذا الإعداد حتى تقدر تشغّل مشروع العقود على `8000` في نفس الوقت.

## إعداد نسخة جديدة

الأوامر التالية تبدأ من جذر المشروع. البيئة المستخدمة محليًا هي Python 3.11 وNode.js 24. ملفات اعتماد JavaScript وقفل الإصدارات موجودة داخل `frontend/`.

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm.cmd --prefix frontend ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
if (!(Test-Path frontend/.env)) { Copy-Item frontend/.env.example frontend/.env }
```

| الملف | الإعداد | الاستخدام |
|---|---|---|
| `.env` | `SUPABASE_URL` | عنوان مشروع Supabase الذي يتحقق منه الخادم عند تسجيل الدخول. |
| `frontend/.env` | `VITE_SUPABASE_URL`، `VITE_SUPABASE_ANON_KEY` | نفس عنوان المشروع ومفتاحه العام للمتصفح. |
| `frontend/.env` | `VITE_API_BASE_URL` | عنوان API المحلي، وقيمته هنا `http://127.0.0.1:8001`. |
| `.env` | `SIMULATOR_API_KEY` | مفتاح خاص تختاره للمحاكي وفحص مسارات الـAPI المحمية. |
| `.env` | `BOT_TOKEN`، `CHAT_ID` | إعدادات اختيارية لإرسال تنبيهات Telegram. |

عند إعداد مشروع Supabase جديد، شغّل [ملف إنشاء الجداول والصلاحيات](frontend/supabase/migrations/001_initial.sql) مرة واحدة في SQL Editor. يستخدم الخادم مفاتيح التوقيع `ES256` للتحقق من جلسات المستخدمين. احتفظ بالمفاتيح الخاصة في ملف الخادم. متغيّرات `VITE_*` تصل إلى المتصفح.

### ملفات النماذج والبيانات

| المسار | متى تحتاجه |
|---|---|
| `models/fall_det_1.pt` | أوزان YOLO لكشف السقوط، مرفقة بالمستودع. يمكن تعيين نموذج آخر عبر `MODEL_PATH` في `.env`. |
| `models/vitals_model.pkl`، `models/vitals_scaler.pkl`، `models/vitals_labels.pkl` | ملفات مصنّف المؤشرات الحيوية الجاهز، مرفقة معًا في المستودع. |
| `data/human_vital_signs_dataset_2024.csv` | بيانات التدريب ومحاكاة الساعات. يمكن تشغيل اللوحة بالنماذج الجاهزة دون ملف التدريب. |
| `known_faces/` | صور اختيارية للتعرّف على الوجه بصيغة مثل `Name_1.jpg`. |
| `data/guardiancare.db` | قاعدة SQLite المحلية. ينشئها التطبيق عند أول تشغيل. استخدم قاعدة النسخة الحالية إذا أردت سجلّها السابق. |

بعد تنزيل المشروع وإعداد ملفّي البيئة، يمكنك تشغيل الخادم بالنماذج المرفقة. يحتفظ كل تثبيت بقاعدة SQLite وصور الوجوه والتنبيهات محليًا. للتدريب أو تشغيل محاكي الساعات، أضف ملف CSV في المسار الموضّح أعلاه.

## خريطة الكود

| المسار | المسؤولية |
|---|---|
| `guardiancare_api/main.py` و`api/routes.py` داخل الحزمة | بدء FastAPI وتحميل النماذج وتعريف المسارات. |
| `guardiancare_api/config.py` و`database.py` داخل الحزمة | قراءة إعدادات المشروع وتحديد المسارات والوصول إلى SQLite. |
| `guardiancare_api/models/` و`guardiancare_api/services/` | تشغيل النماذج، اتخاذ قرار التنبيه، وإرسال رسائل Telegram. |
| `scripts/` | أدوات الفيديو وتدريب النموذج ومحاكاة قراءات الساعات. |
| `tests/test_api.py` | فحص التكامل مع الخادم المحلي. |
| [frontend/](frontend/README.md) | واجهة React ولوحة المتابعة والإدارة. |
| `alerts/` و`logs/` | لقطات التنبيه وسجلات تشغيل الخادم. |

## أدوات المشروع

شغّل الأدوات من الجذر بمفسّر المشروع. المحاكي يولّد قراءات تُكتب في قاعدة الخادم المستهدف، وقد تظهر في سجل الحوادث. التدريب يكتب ملفات النموذج الثلاثة في `models/`.

| الغرض | أمر PowerShell |
|---|---|
| محاكاة ساعات المرضى بعد تشغيل الـAPI | `.\.venv\Scripts\python.exe -m scripts.vitals_simulator` |
| تدريب مصنّف المؤشرات من ملف CSV | `.\.venv\Scripts\python.exe -m scripts.train_vitals` |
| كشف السقوط من الفيديو المحلي `videos/fall.mp4` | `.\.venv\Scripts\python.exe -m scripts.video`، ثم `q` للخروج |
| فحص الـAPI بعد تشغيله وضبط مفتاح المحاكي | `.\.venv\Scripts\python.exe -m tests.test_api` |
| فحص الواجهة وبناؤها | `npm.cmd --prefix frontend run lint` ثم `npm.cmd --prefix frontend run build` |

## إذا ظهرت مشكلة

- **الموقع يفتح ولا يحمّل البيانات** — افتح [حالة الخادم](http://127.0.0.1:8001/health). إذا فتح الرابط، تأكد أن `VITE_API_BASE_URL` يشير لنفس المنفذ، ثم أعد تشغيل Vite بعد تعديل ملف البيئة.
- **تظهر استجابة 401** — سجّل الدخول للموقع وتأكد أن ملفّي البيئة يشيران لنفس مشروع Supabase. للمحاكي والفحص، تأكد أن الخادم قرأ `SIMULATOR_API_KEY` بعد آخر تعديل.
- **PowerShell لا يجد ملفًا أو مكتبة** — نفّذ `Get-Location`. الجذر الصحيح يحتوي على `guardiancare_api` و`frontend` و`requirements.txt`. استخدم المسار الكامل لمفسّر `.venv` كما في أمر التشغيل.
