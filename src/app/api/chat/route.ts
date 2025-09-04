import { NextRequest, NextResponse } from 'next/server';
import { getRateLimitInfo, incrementRateLimit } from './rate-limit';

// 获取API密钥
const apiKey =  process.env.OPEN_ROUTER_API_KEY;

// OpenRouter API的URL
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// 基础系统提示
const BASE_SYSTEM_PROMPT = `You are an AI assistant for HyperIndex, a DeFi platform built on blockchain technology.

Key information about HyperIndex:
- HyperIndex is a decentralized exchange (DEX) platform
- It allows users to swap tokens, provide liquidity, and earn rewards
- HyperIndex uses HSK as its native token
- Users can create and manage liquidity pools
- The platform supports various blockchain wallets for connection

Your task is to be helpful, informative, and concise. Provide accurate information about blockchain concepts, DeFi, and HyperIndex features.
If you don't know the answer to a question, be honest and suggest where the user might find that information.

Respond in a friendly, professional manner and prioritize security best practices in your recommendations.`;

// 获取客户端IP地址
function getClientIp(req: NextRequest): string {
  // 尝试从Cloudflare或其他代理的头部信息获取IP
  const forwarded = req.headers.get('x-forwarded-for');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  
  if (cfConnectingIp) return cfConnectingIp;
  if (forwarded) return forwarded.split(',')[0].trim();
  
  // 如果没有找到，返回一个默认值
  return '127.0.0.1';
}

export async function POST(request: NextRequest) {
  try {
    // 获取客户端IP和速率限制检查
    const clientIp = getClientIp(request);
    const rateLimitInfo = getRateLimitInfo(clientIp);
    
    if (rateLimitInfo.remaining <= 0) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const { messages } = body;

    if (!Array.isArray(messages) || !apiKey) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    incrementRateLimit(clientIp);

    // 准备消息
    const finalMessages = messages.some(m => m.role === 'system')
      ? messages 
      : [{ role: 'system', content: BASE_SYSTEM_PROMPT }, ...messages];

    // 准备发送给OpenRouter的请求
    const payload = {
      messages: finalMessages,
      model: "deepseek/deepseek-r1:free",
      max_tokens: 1000,
      temperature: 0.7,
      stream: true, // 启用流式响应
    };

    // 发送请求到OpenRouter
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://hyperindex.trade',
        'X-Title': 'HyperIndex Assistant',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "API Error" },
        { status: response.status }
      );
    }

    // 创建一个 TransformStream 来处理数据
    const stream = new TransformStream({
      async transform(chunk, controller) {
        try {
          // 解析数据块
          const text = new TextDecoder().decode(chunk);
          const lines = text.split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              
              // 跳过结束标记
              if (data === '[DONE]') {
                continue;
              }
              
              try {
                // 确保数据是完整的 JSON
                if (data) {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    // 直接发送文本内容
                    controller.enqueue(content);
                  }
                }
              } catch (e) {
                console.error('Error parsing JSON:', e);
                // 继续处理下一行，不中断流
                continue;
              }
            }
          }
        } catch (e) {
          console.error('Transform error:', e);
        }
      }
    });

    // 将 API 响应通过 stream 传输
    return new Response(response.body?.pipeThrough(stream), {
      headers: {
        'Content-Type': 'text/plain', // 改为 text/plain，因为我们直接发送文本
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-RateLimit-Limit': rateLimitInfo.limit.toString(),
        'X-RateLimit-Remaining': (rateLimitInfo.remaining - 1).toString(),
        'X-RateLimit-Reset': Math.floor(rateLimitInfo.resetAt.getTime() / 1000).toString()
      }
    });

  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 