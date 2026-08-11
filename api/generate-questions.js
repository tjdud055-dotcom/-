// POST { bookTitle, bookAuthor } -> { questions: string[] }
// Gemini API 키는 Vercel 프로젝트의 환경변수 GEMINI_API_KEY로 설정합니다.

// Gemini는 responseMimeType:'application/json'을 줘도 가끔 ```json ... ``` 코드블록으로
// 감싸거나 앞뒤에 설명 문구를 붙여 보낼 때가 있어서, 곧바로 JSON.parse하면 실패할 수 있습니다.
// 코드블록을 벗겨내고, 그래도 안 되면 첫 '{'~마지막 '}' 구간만 잘라서 한 번 더 시도합니다.
//
// 그래도 실패하면 문자열 값 안에 이스케이프 안 된 큰따옴표(예: 질문 문장 속 "인용")가
// 섞여 들어와 JSON이 깨진 경우일 수 있어서(SyntaxError: Unterminated string), 이스케이프를
// 보정한 버전으로 마지막으로 한 번 더 시도합니다.
function escapeUnescapedQuotes(text) {
  let result = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inString && ch === '\\') {
      // 이미 이스케이프된 문자는 그대로 보존 (\", \\, \n 등)
      result += ch + (text[i + 1] ?? '')
      i++
      continue
    }

    if (ch === '"') {
      if (!inString) {
        inString = true
        result += ch
        continue
      }
      // 문자열 안에서 큰따옴표를 만남: 이게 진짜 닫는 따옴표인지, 아니면 문장 속에
      // 섞인 인용부호인지 뒤쪽을 살펴봐서 판단합니다. 공백을 건너뛴 다음 글자가
      // , } ] : 중 하나거나 문자열 끝이면 "진짜 닫는 따옴표"로 보고,
      // 그 외(한글/영문 등 내용이 이어짐)면 문장 속 인용부호로 보고 이스케이프합니다.
      let j = i + 1
      while (j < text.length && /\s/.test(text[j])) j++
      const next = text[j]
      const looksLikeClose = next === undefined || ',}]:'.includes(next)
      if (looksLikeClose) {
        inString = false
        result += ch
      } else {
        result += '\\"'
      }
      continue
    }

    result += ch
  }
  return result
}

function parseQuestionsJSON(raw) {
  const attempts = [raw.trim()]

  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenceMatch) attempts.push(fenceMatch[1].trim())

  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) attempts.push(raw.slice(start, end + 1).trim())

  // 위 세 가지 시도를 그대로도 해보고, 이스케이프 보정을 적용한 버전으로도 해봅니다.
  const candidates = attempts.filter(Boolean)
  for (const text of [...candidates]) candidates.push(escapeUnescapedQuotes(text))

  let lastErr
  for (const text of candidates) {
    try {
      const parsed = JSON.parse(text).questions
      if (Array.isArray(parsed)) return parsed
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr || new Error('빈 응답')
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST만 지원합니다.' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[generate-questions] GEMINI_API_KEY 환경변수가 설정되어 있지 않아요.')
    res.status(500).json({ error: '서버에 GEMINI_API_KEY가 설정되어 있지 않아요.' })
    return
  }
  // Gemini(Google AI Studio) API 키는 보통 "AIza"로 시작합니다. 다른 서비스 키를 잘못 넣었거나
  // 앞뒤 공백/줄바꿈이 딸려 들어온 경우 여기서 바로 원인을 알 수 있게 로그만 남깁니다.
  if (!/^AIza/.test(apiKey.trim()) || apiKey !== apiKey.trim()) {
    console.warn(`[generate-questions] GEMINI_API_KEY 형식이 의심스러워요. prefix=${apiKey.slice(0, 4)} length=${apiKey.length} trimmed=${apiKey === apiKey.trim()}`)
  }

  const { bookTitle, bookAuthor } = req.body || {}
  if (!bookTitle || typeof bookTitle !== 'string') {
    res.status(400).json({ error: 'bookTitle이 필요해요.' })
    return
  }

  const model = 'gemini-2.5-flash'
  const requestBody = {
    contents: [{
      role: 'user',
      parts: [{
        text: `당신은 독서 토론 진행자입니다. 다음 책에 대한 깊이 있는 토론 질문을 3~5개 생성해주세요.

책 제목: ${bookTitle}
저자: ${bookAuthor || '미상'}

요구사항: 책의 핵심 주제 관련, 개인 경험과 연결, 해석과 감상을 묻는 질문, 한국어, 간결한 한 문장.
중요: 질문 문장 안에는 큰따옴표(")를 절대 쓰지 마세요. 인용이나 강조가 필요하면 작은따옴표(')를 대신 쓰세요.
다른 설명 없이 JSON으로만 응답하세요: {"questions":["질문1","질문2","질문3"]}`,
      }],
    }],
    generationConfig: {
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  }

  let geminiRes
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey.trim(),
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    )
  } catch (err) {
    // fetch 자체가 던지는 경우 (DNS/네트워크 오류 등) - Gemini까지 요청이 가지도 못한 상태
    console.error('[generate-questions] Gemini API 호출 자체가 실패했어요 (네트워크 오류):', err)
    res.status(502).json({ error: 'Gemini API에 연결하지 못했어요.', detail: err?.message || String(err) })
    return
  }

  if (!geminiRes.ok) {
    const detail = await geminiRes.text().catch(() => '(응답 본문을 읽지 못함)')
    // 상태 코드별 흔한 원인: 400=요청 body 구조/모델 오류, 403=API 키 오류/권한, 404=model 이름 오류, 429=rate limit, 503=Gemini 과부하
    console.error(
      `[generate-questions] Gemini API 요청 실패 status=${geminiRes.status} model=${model} body=${detail}`
    )
    res.status(502).json({ error: 'Gemini API 요청에 실패했어요.', status: geminiRes.status, detail })
    return
  }

  try {
    const data = await geminiRes.json()
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    console.log(`[generate-questions] Gemini raw text (length=${raw.length}):`, raw)

    let questions
    try {
      questions = parseQuestionsJSON(raw)
    } catch (parseErr) {
      console.error('[generate-questions] AI 응답 JSON 파싱 실패. raw text:', raw, parseErr)
      res.status(502).json({ error: 'AI 응답을 해석하지 못했어요.' })
      return
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      console.error('[generate-questions] AI가 questions 배열을 반환하지 않았어요. raw text:', raw)
      res.status(502).json({ error: '생성된 질문이 없어요.' })
      return
    }

    res.status(200).json({ questions: questions.slice(0, 5) })
  } catch (err) {
    console.error('[generate-questions] 응답 처리 중 서버 오류:', err)
    res.status(500).json({ error: '서버 오류: ' + (err?.message || 'unknown') })
  }
}
