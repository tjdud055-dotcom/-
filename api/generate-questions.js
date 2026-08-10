// POST { bookTitle, bookAuthor } -> { questions: string[] }
// Anthropic API 키는 Vercel 프로젝트의 환경변수 ANTHROPIC_API_KEY로 설정합니다.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST만 지원합니다.' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: '서버에 ANTHROPIC_API_KEY가 설정되어 있지 않아요.' })
    return
  }

  const { bookTitle, bookAuthor } = req.body || {}
  if (!bookTitle || typeof bookTitle !== 'string') {
    res.status(400).json({ error: 'bookTitle이 필요해요.' })
    return
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `당신은 독서 토론 진행자입니다. 다음 책에 대한 깊이 있는 토론 질문을 3~5개 생성해주세요.

책 제목: ${bookTitle}
저자: ${bookAuthor || '미상'}

요구사항: 책의 핵심 주제 관련, 개인 경험과 연결, 해석과 감상을 묻는 질문, 한국어, 간결한 한 문장.
다른 설명 없이 JSON으로만 응답하세요: {"questions":["질문1","질문2","질문3"]}`,
        }],
      }),
    })

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text().catch(() => '')
      res.status(502).json({ error: 'Anthropic API 요청에 실패했어요.', detail })
      return
    }

    const data = await anthropicRes.json()
    const raw = data?.content?.[0]?.text ?? ''
    let questions
    try {
      questions = JSON.parse(raw).questions
    } catch {
      res.status(502).json({ error: 'AI 응답을 해석하지 못했어요.' })
      return
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      res.status(502).json({ error: '생성된 질문이 없어요.' })
      return
    }

    res.status(200).json({ questions: questions.slice(0, 5) })
  } catch (err) {
    res.status(500).json({ error: '서버 오류: ' + (err?.message || 'unknown') })
  }
}
