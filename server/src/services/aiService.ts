import { env } from '../config/env';

export interface SymptomAssessmentResult {
  isEmergency: boolean;
  isMock: boolean;
  emergencyType?: string;
  advice: string;
  adviceHindi: string;
  recommendedDepartment?: string;
  disclaimer: string;
}

export interface ReportAnalysisResult {
  summary: string;
  summaryHindi: string;
  keyFindings: Array<{
    parameter: string;
    value: string;
    status: 'normal' | 'high' | 'low' | 'attention';
    explanation: string;
    explanationHindi: string;
  }>;
  suggestedQuestionsForDoctor: string[];
  disclaimer: string;
  isMock: boolean;
}

const RED_FLAGS = [
  { trigger: ['chest pain', 'heart attack', 'cleft chest', 'crushing pain', 'left arm pain'], type: 'Cardiac Emergency / दिल का दौरा' },
  { trigger: ['cannot breathe', 'difficulty breathing', 'severe breathlessness', 'suffocating', 'gasping'], type: 'Respiratory Failure / सांस लेने में गंभीर तकलीफ' },
  { trigger: ['unconscious', 'passed out', 'fainted and not waking', 'loss of consciousness'], type: 'Altered Sensorium / बेहोशी' },
  { trigger: ['stroke', 'face drooping', 'arm weakness', 'speech slurred', 'paralysis'], type: 'Cerebrovascular Stroke / लकवा / स्ट्रोक' },
  { trigger: ['heavy bleeding', 'severe blood loss', 'vomiting blood', 'coughing blood'], type: 'Hemorrhage / अत्यधिक रक्तस्राव' },
  { trigger: ['severe head injury', 'skull trauma', 'head trauma convulsion'], type: 'Head Injury / गंभीर सिर की चोट' },
  { trigger: ['poison', 'swallowed chemical', 'snake bite'], type: 'Toxic Ingestion / विषपान / सर्पदंश' },
];

export class AIService {
  public static isAvailable(): boolean {
    if (env.AI_PROVIDER === 'mock') return env.NODE_ENV !== 'production';
    if (env.AI_PROVIDER === 'gemini') return !!env.AI_API_KEY;
    return false;
  }

  public static checkEmergencyRedFlags(text: string): SymptomAssessmentResult | null {
    const lower = text.toLowerCase();
    for (const flag of RED_FLAGS) {
      if (flag.trigger.some((word) => lower.includes(word))) {
        return {
          isEmergency: true,
          isMock: true,
          emergencyType: flag.type,
          advice: `RED FLAG DETECTED: Symptoms describe a potential medical emergency (${flag.type}). DO NOT DELAY. Call National Emergency Helpline 112 / 108 or go immediately to the nearest Hospital Emergency Room / Trauma Center.`,
          adviceHindi: `आपातकालीन चेतावनी: आपके लक्षण चिकित्सीय आपात स्थिति (${flag.type}) की ओर संकेत कर रहे हैं। बिना देर किए तुरंत 112 / 108 पर संपर्क करें या नजदीकी अस्पताल के इमरजेंसी/ट्रॉमा वार्ड में जाएं।`,
          recommendedDepartment: 'Emergency / Trauma / ICU',
          disclaimer: 'Swasthya AI is not an emergency dispatch system or medical replacement. In emergencies, call 112 / 108 immediately.',
        };
      }
    }
    return null;
  }

  public static async callGemini(prompt: string): Promise<string | null> {
    if (env.AI_PROVIDER !== 'gemini' || !env.AI_API_KEY) return null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${env.AI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        console.error('[AI] Gemini HTTP', res.status);
        return null;
      }
      const data: any = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return text ? String(text).trim() : null;
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[AI] Gemini call failed:', err?.message);
      return null;
    }
  }
  public static async analyzeSymptoms(symptoms: string, language: 'en' | 'hi' = 'en'): Promise<SymptomAssessmentResult> {
    // First, check red flags
    const redFlag = this.checkEmergencyRedFlags(symptoms);
    if (redFlag) {
      return redFlag;
    }

    // Use Gemini if configured
    const geminiText = await this.callGemini(
      `You are a healthcare assistant. The user reports these symptoms: "${symptoms}". ` +
      `Respond in ${language === 'hi' ? 'Hindi' : 'English'}. Provide: 1) possible department/specialty, 2) general guidance, 3) when to see a doctor. ` +
      `Do NOT diagnose. Include a disclaimer that this is not medical advice. Keep it concise.`
    );
    if (geminiText) {
      return {
        isEmergency: false,
        isMock: false,
        advice: geminiText,
        adviceHindi: language === 'hi' ? geminiText : 'AI-generated guidance available in English.',
        recommendedDepartment: 'General Medicine',
        disclaimer: 'AI-generated informational guidance only. Not a medical diagnosis. Consult a licensed clinician.',
      };
    }

    // Normal symptom guidance
    const lower = symptoms.toLowerCase();
    let department = 'General Medicine';
    let enAdvice = 'These symptoms should be evaluated by a healthcare professional. Ensure rest, hydration, and note any changes in temperature or intensity.';
    let hiAdvice = 'इन लक्षणों की डॉक्टर द्वारा जांच करानी चाहिए। पर्याप्त आराम करें, पानी पिएं और तापमान में किसी भी बदलाव पर ध्यान रखें।';

    if (lower.includes('fever') || lower.includes('bukhar') || lower.includes('temperature') || lower.includes('chills')) {
      department = 'General Medicine / Internal Medicine';
      enAdvice = 'Fever could indicate a viral or bacterial infection (such as flu, malaria, typhoid, or dengue). Monitor body temperature regularly, stay hydrated, and visit an OPD doctor if it persists beyond 48 hours.';
      hiAdvice = 'बुखार वायरल या बैक्टीरियल संक्रमण (जैसे फ्लू, मलेरिया, टाइफाइड या डेंगू) का संकेत हो सकता है। नियमित रूप से तापमान मापें, ओआरएस या पानी पिएं, और यदि यह 48 घंटे से अधिक रहे तो डॉक्टर को दिखाएं।';
    } else if (lower.includes('cough') || lower.includes('cold') || lower.includes('throat') || lower.includes('khansi')) {
      department = 'Pulmonology / ENT / General Medicine';
      enAdvice = 'Upper respiratory symptoms like cough and sore throat are commonly caused by viral pharyngitis or allergies. Warm salt water gargles and steam inhalation may provide symptomatic relief.';
      hiAdvice = 'खांसी और गले में खराश अक्सर वायरल संक्रमण या एलर्जी के कारण होती है। गुनगुने नमक के पानी से गरारे करें और भाप लें। यदि सांस लेने में कठिनाई हो तो तुरंत डॉक्टर से मिलें।';
    } else if (lower.includes('skin') || lower.includes('rash') || lower.includes('itch') || lower.includes('khujli')) {
      department = 'Dermatology';
      enAdvice = 'Rashes or itching can be triggered by contact allergens, fungal infections, or eczema. Avoid scratching and keep the area dry until a dermatologist examines the lesions.';
      hiAdvice = 'त्वचा पर चकत्ते या खुजली एलर्जी या फंगल इन्फेक्शन के कारण हो सकती है। खुजलाने से बचें और त्वचा रोग विशेषज्ञ को दिखाएं।';
    } else if (lower.includes('joint') || lower.includes('bone') || lower.includes('knee') || lower.includes('dard') || lower.includes('back')) {
      department = 'Orthopedics / Physiotherapy';
      enAdvice = 'Joint or musculoskeletal discomfort might stem from strain, osteoarthritis, or posture issues. Gentle mobilization and hot/cold fomentation may help.';
      hiAdvice = 'जोड़ों या कमर का दर्द खिंचाव या गठिया के कारण हो सकता है। अधिक वजन उठाने से बचें और ऑर्थोपेडिक विशेषज्ञ से परामर्श लें।';
    }

    return {
      isEmergency: false,
      isMock: true,
      advice: enAdvice,
      adviceHindi: hiAdvice,
      recommendedDepartment: department,
      disclaimer: 'Informational guidance only. Not a medical diagnosis or treatment prescription. Always consult an authorized clinician.',
    };
  }

  public static async explainLabReport(reportText: string, parameters: Array<{ name: string; value: string; unit?: string }>): Promise<ReportAnalysisResult> {
    // Try Gemini if configured
    const geminiText = await this.callGemini(
      `You are a medical report explainer. Given these lab parameters: ${JSON.stringify(parameters)}. ` +
      `Report text: ${reportText || 'N/A'}. ` +
      `For each parameter, classify as normal/high/low/attention and explain in simple terms (English). ` +
      `Return JSON with keys: summary (string), keyFindings (array of {parameter, value, status, explanation, explanationHindi}), ` +
      `suggestedQuestionsForDoctor (string[]), disclaimer (string). Ensure valid JSON only.`
    );
    if (geminiText) {
      try {
        const parsed = JSON.parse(geminiText.replace(/```json|```/g, '').trim());
        return {
          summary: parsed.summary || 'AI-generated report summary.',
          summaryHindi: parsed.summaryHindi || parsed.summary || 'AI-generated report summary.',
          keyFindings: (parsed.keyFindings || []).map((k: any) => ({
            parameter: k.parameter,
            value: k.value,
            status: k.status || 'attention',
            explanation: k.explanation || '',
            explanationHindi: k.explanationHindi || k.explanation || '',
          })),
          suggestedQuestionsForDoctor: parsed.suggestedQuestionsForDoctor || [],
          disclaimer: parsed.disclaimer || 'AI-generated. Confirm with a licensed clinician.',
          isMock: false,
        };
      } catch {
        // fall through to mock
      }
    }

    const keyFindings = parameters.map((param) => {
      const value = param.value + (param.unit ? ` ${param.unit}` : '');

      return {
        parameter: param.name,
        value,
        status: 'attention' as const,
        explanation: `Supplied value: ${value}. No reference range was supplied, so this demo cannot classify it as normal or abnormal.`,
        explanationHindi: `दिया गया मान: ${value}। कोई संदर्भ सीमा नहीं दी गई है, इसलिए यह डेमो इसे सामान्य या असामान्य नहीं बता सकता।`,
      };
    });

    return {
      summary: 'Development-only template output. No reference ranges were supplied, so no clinical interpretation is made.',
      summaryHindi: 'केवल विकास/डेमो हेतु टेम्पलेट उत्तर। संदर्भ सीमाएं उपलब्ध नहीं हैं, इसलिए कोई चिकित्सीय व्याख्या नहीं की गई है।',
      keyFindings,
      suggestedQuestionsForDoctor: [
        'Do I need any dietary modifications based on these values?',
        'Should any of these tests be repeated after a few weeks?',
        'Are these test results influenced by any medication I currently take?',
      ],
      disclaimer: 'This is not AI or clinician interpretation. Confirm values and reference ranges with the laboratory and a licensed clinician.',
      isMock: true,
    };
  }

  public static async chat(message: string, language: 'en' | 'hi' = 'en'): Promise<string> {
    const geminiText = await this.callGemini(
      `You are Swasthya AI, a helpful healthcare assistant. User message: "${message}". ` +
      `Respond in ${language === 'hi' ? 'Hindi' : 'English'}. Be concise, safe, non-diagnostic. ` +
      `Include a disclaimer that this is not medical advice.`
    );
    if (geminiText) return geminiText;

    // Local fallback so the chatbot remains usable when the live provider is unavailable.
    const lower = message.toLowerCase();
    if (lower.includes('fever') || lower.includes('bukhar')) {
      return (language === 'hi'
        ? 'बुखार के लिए आराम करें, पर्याप्त पानी पिएं और तापमान नापें। यदि बुखार 3 दिन से अधिक रहे या सांस लेने में तकलीफ हो तो डॉक्टर से मिलें।'
        : 'For fever: rest, hydrate, and monitor temperature. If fever persists beyond 3 days or breathing difficulty occurs, consult a doctor.') +
        '\n\nDisclaimer: Informational only, not medical advice.';
    }
    if (lower.includes('headache') || lower.includes('sir dard')) {
      return (language === 'hi'
        ? 'सिरदर्द के लिए आराम, पानी और कम रोशनी में आराम करें। अचानक तेज़ सिरदर्द या उल्टी हो तो तुरंत डॉक्टर से मिलें।'
        : 'For headache: rest, hydrate, and avoid bright light. Seek immediate care for sudden severe headache or vomiting.') +
        '\n\nDisclaimer: Informational only, not medical advice.';
    }
    if (lower.includes('cough') || lower.includes('khansi')) {
      return (language === 'hi'
        ? 'खांसी के लिए गर्म पानी, भाप और गले की आराम दें। यदि खांसी 2 हफ्ते से अधिक रहे तो डॉक्टर से मिलें।'
        : 'For cough: warm fluids, steam, and throat rest. Consult a doctor if cough persists beyond 2 weeks.') +
        '\n\nDisclaimer: Informational only, not medical advice.';
    }
    return (language === 'hi'
      ? 'मैं आपके स्वास्थ्य सवालों में मदद कर सकता हूं (बुखार, खांसी, सिरदर्द आदि)। तत्काल आपात स्थिति में 112/108 पर कॉल करें।'
      : 'I can help with general health questions (fever, cough, headache, etc.). For emergencies, call 112/108 immediately.') +
      '\n\nDisclaimer: Informational only, not medical advice. Consult a licensed clinician.';
  }

  public static async drugInteractionCheck(medicines: string[]): Promise<string> {
    const geminiText = await this.callGemini(
      `You are a clinical pharmacology assistant. Check for potential interactions/allergies among these medicines: ${medicines.join(', ')}. ` +
      `List any known interactions, contraindications, and precautions in concise bullet points. ` +
      `Always recommend consulting a pharmacist/clinician. This is informational only.`
    );
    return geminiText || 'Interaction check unavailable (AI not configured).';
  }

  public static async generateClinicalDraftSummary(clinicalNotes: {
    symptoms?: string;
    examination?: string;
    diagnosis?: string;
    plan?: string;
  }): Promise<string> {
    const geminiText = await this.callGemini(
      `Generate a concise clinical SOAP note draft from: symptoms="${clinicalNotes.symptoms || ''}", examination="${clinicalNotes.examination || ''}", diagnosis="${clinicalNotes.diagnosis || ''}", plan="${clinicalNotes.plan || ''}". ` +
      `Mark clearly as AI DRAFT for clinician review. Do not present as final.`
    );
    if (geminiText) return geminiText;
    return `[TEMPLATE DEMO DRAFT - FOR CLINICIAN REVIEW ONLY]
Patient presented with complaints of: ${clinicalNotes.symptoms || 'None recorded'}.
Key examination findings: ${clinicalNotes.examination || 'Not provided'}.
Working clinical assessment: ${clinicalNotes.diagnosis || 'Under evaluation'}.
Outlined management plan: ${clinicalNotes.plan || 'Routine care and monitoring'}.
*This template is not AI-generated or a clinical decision. Review and replace it before use.*`;
  }
}
