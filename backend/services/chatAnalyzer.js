// 채팅 메시지 분석 알고리즘

// 유의미한 키워드 패턴
const MEANINGFUL_PATTERNS = [
  // 프로젝트 관련
  /(프로젝트|과제|작업|진행|완료|제출|마감)/gi,
  /(기능|구현|개발|코드|버그|수정|테스트)/gi,
  /(회의|논의|의견|제안|결정|합의)/gi,
  /(일정|스케줄|계획|진행상황|상태)/gi,
  /(파일|문서|자료|공유|업로드|다운로드)/gi,
  /(문제|이슈|해결|방법|방안|접근)/gi,
  /(리뷰|검토|피드백|개선|수정사항)/gi,
  /(분담|역할|담당|책임|업무)/gi,
  /(데이터|분석|결과|통계|그래프)/gi,
  /(설계|아키텍처|구조|모델)/gi,
];

// 쓸모없는 메시지 패턴
const USELESS_PATTERNS = [
  /(ㅋ|ㅎ|하하|헤헤|ㅠ|ㅜ|ㅇㅇ|응|네|아니|그래)/gi,
  /(감사|고마|수고|잘했|좋아|대박|짱)/gi,
  /(안녕|하이|헬로|반가|만나서)/gi,
  /(밥|식사|점심|저녁|배고|먹)/gi,
  /(오늘|내일|어제|요즘|최근)/gi,
  /(시간|언제|몇시|나중|이따)/gi,
  /(날씨|덥|춥|비|눈)/gi,
  /(피곤|졸|잠|자고|일어나)/gi,
];

// 질문 패턴 (높은 점수)
const QUESTION_PATTERNS = [
  /(어떻게|무엇|왜|언제|어디|누구|어떤)/gi,
  /(방법|해결|처리|구현|작동)/gi,
  /\?/g,
];

// 긍정적 피드백 패턴
const POSITIVE_PATTERNS = [
  /(좋|완벽|훌륭|대단|잘했|수고)/gi,
  /(감사|고마|고맙)/gi,
];

// 부정적 피드백 패턴
const NEGATIVE_PATTERNS = [
  /(문제|오류|에러|버그|실패|안됨|안되)/gi,
  /(수정|변경|개선|바꿔|다시)/gi,
];

/**
 * 메시지의 유의미함 점수 계산 (0-100)
 */
export function calculateRelevanceScore(message) {
  if (!message || message.trim().length === 0) {
    return 0;
  }

  let score = 50; // 기본 점수
  const text = message.toLowerCase();
  const length = message.length;

  // 길이 기반 점수 조정
  if (length < 5) {
    score -= 20; // 너무 짧은 메시지
  } else if (length > 50) {
    score += 10; // 긴 메시지는 보통 더 유의미함
  }

  // 유의미한 패턴 매칭
  let meaningfulCount = 0;
  MEANINGFUL_PATTERNS.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      meaningfulCount += matches.length;
    }
  });
  score += meaningfulCount * 5;

  // 쓸모없는 패턴 매칭
  let uselessCount = 0;
  USELESS_PATTERNS.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      uselessCount += matches.length;
    }
  });
  score -= uselessCount * 3;

  // 질문 패턴 (높은 점수)
  let questionCount = 0;
  QUESTION_PATTERNS.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      questionCount += matches.length;
    }
  });
  score += questionCount * 8;

  // 특수 문자 및 링크 포함 여부
  if (message.includes('http://') || message.includes('https://')) {
    score += 15; // 링크는 보통 유의미함
  }

  if (message.includes('@') || message.includes('#')) {
    score += 5; // 멘션이나 해시태그
  }

  // 점수 범위 제한 (0-100)
  score = Math.max(0, Math.min(100, score));

  return Math.round(score);
}

/**
 * 키워드 추출
 */
export function extractKeywords(message, topN = 5) {
  if (!message) return [];

  const words = message
    .replace(/[^\w\s가-힣]/g, ' ') // 특수문자 제거
    .split(/\s+/)
    .filter(word => word.length > 1); // 1글자 단어 제거

  // 단어 빈도 계산
  const wordFreq = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  // 빈도순으로 정렬
  const sortedWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);

  return sortedWords;
}

/**
 * 기여도 점수 계산 (0-100)
 * 여러 요소를 종합하여 계산
 */
export function calculateContributionScore(messages) {
  if (!messages || messages.length === 0) return 0;

  let totalScore = 0;
  let messageCount = 0;
  let totalLength = 0;
  let questionCount = 0;
  let linkCount = 0;

  messages.forEach(msg => {
    const relevance = calculateRelevanceScore(msg.message);
    totalScore += relevance;
    messageCount++;
    totalLength += msg.message.length;

    // 질문 개수
    if (/\?/.test(msg.message)) {
      questionCount++;
    }

    // 링크 개수
    if (msg.message.includes('http://') || msg.message.includes('https://')) {
      linkCount++;
    }
  });

  // 평균 점수
  const avgScore = totalScore / messageCount;

  // 추가 보너스
  let bonus = 0;
  bonus += (questionCount / messageCount) * 10; // 질문 비율
  bonus += (linkCount / messageCount) * 15; // 링크 공유
  bonus += Math.min(totalLength / messageCount / 50, 5); // 평균 길이 보너스

  const finalScore = Math.min(100, Math.round(avgScore + bonus));
  return finalScore;
}

/**
 * 메시지 분류 (유의미한 대화 vs 쓸모없는 대화)
 */
export function classifyMessage(message) {
  const score = calculateRelevanceScore(message);
  
  if (score >= 70) {
    return 'highly_relevant'; // 매우 유의미
  } else if (score >= 50) {
    return 'relevant'; // 유의미
  } else if (score >= 30) {
    return 'neutral'; // 중립
  } else {
    return 'irrelevant'; // 쓸모없음
  }
}

/**
 * 전체 채팅방 분석
 */
export function analyzeChatRoom(messages) {
  if (!messages || messages.length === 0) {
    return {
      totalMessages: 0,
      relevantMessages: 0,
      irrelevantMessages: 0,
      averageRelevance: 0,
      topKeywords: [],
      userContributions: {}
    };
  }

  const analysis = {
    totalMessages: messages.length,
    relevantMessages: 0,
    irrelevantMessages: 0,
    neutralMessages: 0,
    highlyRelevantMessages: 0,
    totalRelevanceScore: 0,
    keywords: {},
    userContributions: {},
    userMessages: {}
  };

  // 사용자별 메시지 그룹화
  messages.forEach(msg => {
    if (!analysis.userMessages[msg.user_name]) {
      analysis.userMessages[msg.user_name] = [];
    }
    analysis.userMessages[msg.user_name].push(msg);
  });

  // 각 메시지 분석
  messages.forEach(msg => {
    const relevance = calculateRelevanceScore(msg.message);
    const classification = classifyMessage(msg.message);
    const keywords = extractKeywords(msg.message);

    analysis.totalRelevanceScore += relevance;

    // 분류별 카운트
    if (classification === 'highly_relevant') {
      analysis.highlyRelevantMessages++;
      analysis.relevantMessages++;
    } else if (classification === 'relevant') {
      analysis.relevantMessages++;
    } else if (classification === 'neutral') {
      analysis.neutralMessages++;
    } else {
      analysis.irrelevantMessages++;
    }

    // 키워드 수집
    keywords.forEach(keyword => {
      analysis.keywords[keyword] = (analysis.keywords[keyword] || 0) + 1;
    });
  });

  // 사용자별 기여도 계산
  Object.keys(analysis.userMessages).forEach(userName => {
    const userMsgs = analysis.userMessages[userName];
    analysis.userContributions[userName] = {
      messageCount: userMsgs.length,
      contributionScore: calculateContributionScore(userMsgs),
      averageRelevance: userMsgs.reduce((sum, msg) => 
        sum + calculateRelevanceScore(msg.message), 0) / userMsgs.length,
      keywords: {}
    };

    // 사용자별 키워드
    userMsgs.forEach(msg => {
      const keywords = extractKeywords(msg.message);
      keywords.forEach(keyword => {
        analysis.userContributions[userName].keywords[keyword] = 
          (analysis.userContributions[userName].keywords[keyword] || 0) + 1;
      });
    });
  });

  // 평균 유의미함 점수
  analysis.averageRelevance = analysis.totalRelevanceScore / messages.length;

  // 상위 키워드 추출
  analysis.topKeywords = Object.entries(analysis.keywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, count]) => ({ keyword, count }));

  return analysis;
}
