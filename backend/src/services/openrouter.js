import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../../.env') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku';

class OpenRouterService {
  constructor() {
    this.apiKey = OPENROUTER_API_KEY;
    this.baseUrl = OPENROUTER_BASE_URL;
  }

  // Strip markdown code block wrappers (```json, ```text, etc.) from AI responses
  stripCodeBlocks(text) {
    if (typeof text !== 'string') return text;
    // Remove ```lang\n...\n``` wrappers
    return text.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '').trim();
  }

  async chat(messages, options = {}) {
    const {
      model = OPENROUTER_MODEL,
      temperature = 0.7,
      maxTokens = 10000
    } = options;

    if (!this.apiKey || this.apiKey === 'your-openrouter-api-key-here') {
      return this.getMockResponse(messages);
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'AI E-commerce Agent'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'OpenRouter API error');
      }

      const data = await response.json();
      return this.stripCodeBlocks(data.choices[0].message.content);
    } catch (error) {
      console.error('OpenRouter API error:', error);
      return this.getMockResponse(messages);
    }
  }

  getMockResponse(messages) {
    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';

    if (lastMessage.includes('price') || lastMessage.includes('pricing')) {
      return JSON.stringify({
        suggestion: 'Based on market analysis and competitor pricing, I recommend adjusting the price by 5-10% to optimize for both conversion rate and profit margin. Current market conditions suggest a slight price reduction could increase sales volume significantly.',
        confidence: 0.85,
        factors: ['competitor pricing', 'demand trends', 'seasonal patterns']
      });
    }

    if (lastMessage.includes('product') && lastMessage.includes('description')) {
      return 'Experience the perfect blend of innovation and quality. This premium product is designed to exceed your expectations, combining cutting-edge features with exceptional durability. Whether for work or play, it delivers outstanding performance every time.';
    }

    if (lastMessage.includes('ad') || lastMessage.includes('campaign')) {
      return JSON.stringify({
        headline: 'Discover Excellence Today',
        body: 'Premium quality meets unbeatable value. Shop now and experience the difference. Limited time offer!',
        cta: 'Shop Now',
        targetAudience: 'Quality-conscious consumers aged 25-45'
      });
    }

    if (lastMessage.includes('review') || lastMessage.includes('sentiment')) {
      return JSON.stringify({
        sentiment: 'positive',
        score: 0.85,
        keywords: ['quality', 'value', 'recommend'],
        suggestedResponse: 'Thank you for your wonderful feedback! We\'re thrilled that you\'re enjoying our product. Your satisfaction is our priority!'
      });
    }

    if (lastMessage.includes('forecast') || lastMessage.includes('predict')) {
      return JSON.stringify({
        prediction: 'Sales are expected to increase by 15-20% over the next quarter based on historical trends and current market conditions.',
        confidence: 0.78,
        factors: ['seasonal trends', 'market growth', 'promotional calendar']
      });
    }

    if (lastMessage.includes('segment') || lastMessage.includes('customer')) {
      return JSON.stringify({
        insights: 'This customer segment shows high engagement with premium products. They respond well to personalized recommendations and exclusive offers.',
        recommendations: ['Personalized email campaigns', 'VIP early access', 'Loyalty rewards'],
        churnRisk: 'low'
      });
    }

    if (lastMessage.includes('competitor') || lastMessage.includes('analysis')) {
      return JSON.stringify({
        analysis: 'Competitor shows strong presence in mid-market segment. Key differentiators include pricing and brand recognition. Opportunities exist in customer service and product innovation.',
        opportunities: ['Premium positioning', 'Service excellence', 'Niche products'],
        threats: ['Price competition', 'Market expansion']
      });
    }

    if (lastMessage.includes('trend') || lastMessage.includes('market')) {
      return JSON.stringify({
        trend: 'The market shows strong growth potential with increasing consumer interest in sustainable and premium products.',
        growth: '18% YoY',
        recommendations: ['Expand sustainable product line', 'Invest in brand positioning', 'Target emerging demographics']
      });
    }

    return JSON.stringify({
      response: 'AI analysis complete. Based on current data and market conditions, I recommend focusing on customer engagement and product quality to drive growth.',
      confidence: 0.75
    });
  }

  // Generate product description
  async generateProductDescription(product) {
    const messages = [
      {
        role: 'system',
        content: 'You are an expert e-commerce copywriter. Create compelling, SEO-friendly product descriptions that drive sales.'
      },
      {
        role: 'user',
        content: `Generate a compelling product description for: ${product.name}. Category: ${product.category}. Key features: ${product.description || 'Premium quality product'}. Keep it under 100 words, make it engaging and highlight benefits.`
      }
    ];
    return await this.chat(messages);
  }

  // Generate ad copy
  async generateAdCopy(campaign) {
    const messages = [
      {
        role: 'system',
        content: 'You are an expert digital advertising copywriter. Create high-converting ad copy that captures attention and drives action.'
      },
      {
        role: 'user',
        content: `Create ad copy for a ${campaign.platform} campaign. Campaign: ${campaign.name}. Target audience: ${campaign.targetAudience || 'general consumers'}. Budget: $${campaign.budget}. Return as JSON with headline, body, and cta fields.`
      }
    ];
    return await this.chat(messages);
  }

  // Analyze review sentiment
  async analyzeReviewSentiment(review) {
    const messages = [
      {
        role: 'system',
        content: 'You are an expert in sentiment analysis. Analyze customer reviews and provide actionable insights.'
      },
      {
        role: 'user',
        content: `Analyze this review sentiment: "${review.content}". Rating: ${review.rating}/5. Return as JSON with sentiment (positive/neutral/negative), score (0-1), keywords array, and suggestedResponse.`
      }
    ];
    return await this.chat(messages);
  }

  // Generate pricing recommendation
  async generatePricingRecommendation(product, competitorPrice, demand) {
    const messages = [
      {
        role: 'system',
        content: 'You are an expert pricing strategist. Provide data-driven pricing recommendations to maximize profit and competitiveness.'
      },
      {
        role: 'user',
        content: `Recommend pricing for: ${product.name}. Current price: $${product.currentPrice}. Cost: $${product.cost}. Competitor price: $${competitorPrice}. Demand score: ${demand}/100. Return as JSON with suggestedPrice, confidence (0-1), and reasoning.`
      }
    ];
    return await this.chat(messages);
  }

  // Generate sales forecast
  async generateSalesForecast(product, historicalData) {
    const messages = [
      {
        role: 'system',
        content: 'You are an expert in sales forecasting and demand planning. Provide accurate predictions based on historical data and market trends.'
      },
      {
        role: 'user',
        content: `Generate sales forecast for: ${product?.name || 'category'}. Historical average: ${historicalData.avgSales} units/month. Growth trend: ${historicalData.growthRate}%. Seasonality factor: ${historicalData.seasonality}. Return as JSON with predictedSales, confidence (0-1), and factors array.`
      }
    ];
    return await this.chat(messages);
  }

  // Analyze competitor
  async analyzeCompetitor(competitor) {
    const messages = [
      {
        role: 'system',
        content: 'You are an expert competitive analyst. Provide strategic insights based on competitor data.'
      },
      {
        role: 'user',
        content: `Analyze competitor: ${competitor.name}. Market share: ${competitor.marketShare}%. Strengths: ${competitor.strengths?.join(', ')}. Weaknesses: ${competitor.weaknesses?.join(', ')}. Return as JSON with analysis, opportunities array, and threats array.`
      }
    ];
    return await this.chat(messages);
  }

  // Generate customer segment insights
  async generateSegmentInsights(segment) {
    const messages = [
      {
        role: 'system',
        content: 'You are an expert in customer segmentation and behavioral analysis. Provide actionable insights to improve customer engagement.'
      },
      {
        role: 'user',
        content: `Analyze customer segment: ${segment.name}. Customer count: ${segment.customerCount}. Average value: $${segment.averageValue}. Churn rate: ${segment.churnRate}%. Return as JSON with insights, recommendations array, and churnRisk level.`
      }
    ];
    return await this.chat(messages);
  }

  // Generate A/B test recommendation
  async generateABTestRecommendation(test) {
    const messages = [
      {
        role: 'system',
        content: 'You are an expert in experimentation and statistical analysis. Provide recommendations based on A/B test results.'
      },
      {
        role: 'user',
        content: `Analyze A/B test: ${test.name}. Variant A: ${test.variantAConversions}/${test.variantAViews} conversions. Variant B: ${test.variantBConversions}/${test.variantBViews} conversions. Confidence: ${test.confidenceLevel}%. Provide recommendation and next steps.`
      }
    ];
    return await this.chat(messages);
  }

  // Generate content
  async generateContent(type, context) {
    const messages = [
      {
        role: 'system',
        content: `You are an expert content creator specializing in e-commerce ${type}. Create engaging, conversion-focused content.`
      },
      {
        role: 'user',
        content: `Create ${type} content. Context: ${JSON.stringify(context)}. Make it engaging, professional, and optimized for conversion.`
      }
    ];
    return await this.chat(messages);
  }

  // Generate market trend insights
  async generateTrendInsights(trend) {
    const messages = [
      {
        role: 'system',
        content: 'You are an expert market analyst. Provide strategic insights based on market trends and data.'
      },
      {
        role: 'user',
        content: `Analyze market trend: ${trend.trendName} in ${trend.category}. Growth rate: ${trend.growthRate}%. Competition: ${trend.competitionLevel}. Provide strategic recommendations for capitalizing on this trend.`
      }
    ];
    return await this.chat(messages);
  }

  // Analyze fraud alert
  async analyzeFraudAlert(alert) {
    const messages = [
      {
        role: 'system',
        content: 'You are an expert fraud analyst specializing in e-commerce transaction security. Analyze potential fraud cases and provide actionable recommendations.'
      },
      {
        role: 'user',
        content: `Analyze this potential fraud alert:
          Alert Type: ${alert.alertType}
          Risk Score: ${alert.riskScore}/100
          Order Amount: $${alert.orderAmount}
          Customer Email: ${alert.customerEmail}
          IP Address: ${alert.ipAddress}
          Risk Indicators: ${alert.indicators?.join(', ') || 'None specified'}
          Shipping Address: ${JSON.stringify(alert.shippingAddress)}
          Billing Address: ${JSON.stringify(alert.billingAddress)}

          Provide a detailed analysis and recommendation in JSON format with fields: analysis (detailed explanation), recommendation (action to take), confidenceScore (0-100), suggestedActions (array of specific steps).`
      }
    ];

    if (!this.apiKey || this.apiKey === 'your-openrouter-api-key-here') {
      return JSON.stringify({
        analysis: `This ${alert.alertType} alert shows ${alert.riskScore >= 70 ? 'significant' : 'moderate'} fraud indicators. The transaction amount of $${alert.orderAmount} combined with ${alert.indicators?.length || 0} risk indicators warrants ${alert.riskScore >= 80 ? 'immediate investigation' : 'careful review'}. ${alert.shippingAddress?.city !== alert.billingAddress?.city ? 'Address mismatch between shipping and billing detected.' : 'Addresses appear consistent.'}`,
        recommendation: alert.riskScore >= 80 ? 'Block transaction and contact customer for verification' : alert.riskScore >= 50 ? 'Hold order for manual review before processing' : 'Monitor transaction but allow to proceed',
        confidenceScore: Math.min(95, alert.riskScore + 10),
        suggestedActions: [
          'Verify customer identity through secondary authentication',
          'Check order history for similar patterns',
          alert.riskScore >= 70 ? 'Contact customer via phone to verify order' : 'Send verification email to customer',
          'Document findings for future reference'
        ]
      });
    }

    return await this.chat(messages);
  }

  // Generate cart recovery strategy
  async generateCartRecoveryStrategy(cart) {
    const messages = [
      {
        role: 'system',
        content: 'You are an expert e-commerce recovery specialist. Create personalized cart recovery strategies that convert abandoned carts into purchases.'
      },
      {
        role: 'user',
        content: `Generate a recovery strategy for this abandoned cart:
          Customer Name: ${cart.customerName}
          Customer Email: ${cart.customerEmail}
          Cart Value: $${cart.cartTotal}
          Items: ${JSON.stringify(cart.cartItems)}
          Abandoned: ${cart.abandonedAt}
          Device: ${cart.deviceType || 'Unknown'}
          Exit Page: ${cart.exitPage || 'Checkout'}
          Recovery Stage: ${cart.recoveryStage}
          Emails Already Sent: ${cart.recoveryEmailsSent || 0}

          Provide a recovery strategy in JSON format with fields: personalizedMessage (email body text), subject (email subject line), recommendedDiscount (percentage 0-25), strategy (brief explanation), urgencyLevel (low/medium/high), bestTimeToSend (time of day).`
      }
    ];

    if (!this.apiKey || this.apiKey === 'your-openrouter-api-key-here') {
      const itemNames = cart.cartItems?.map(i => i.name).join(', ') || 'items';
      const discount = cart.cartTotal > 200 ? 15 : cart.cartTotal > 100 ? 10 : 5;
      const urgency = cart.recoveryEmailsSent >= 2 ? 'high' : cart.recoveryEmailsSent === 1 ? 'medium' : 'low';

      return JSON.stringify({
        personalizedMessage: `Hi ${cart.customerName || 'there'},\n\nWe noticed you left some great items in your cart! Your ${itemNames} ${cart.cartItems?.length > 1 ? 'are' : 'is'} waiting for you.\n\n${discount > 0 ? `As a special offer, use code COMEBACK${discount} for ${discount}% off your order!` : ''}\n\nComplete your purchase today and enjoy fast shipping.\n\nBest regards,\nThe Team`,
        subject: cart.recoveryEmailsSent === 0 ? `Don't forget your ${itemNames}!` : cart.recoveryEmailsSent === 1 ? `Your cart misses you, ${cart.customerName || 'friend'}!` : `Last chance: ${discount}% off your cart!`,
        recommendedDiscount: discount,
        strategy: `${urgency === 'high' ? 'Final attempt with maximum discount incentive' : urgency === 'medium' ? 'Follow-up with moderate discount offer' : 'Initial gentle reminder without heavy discounting'} targeting cart value of $${cart.cartTotal}.`,
        urgencyLevel: urgency,
        bestTimeToSend: '10:00 AM'
      });
    }

    return await this.chat(messages);
  }
}

export default new OpenRouterService();
