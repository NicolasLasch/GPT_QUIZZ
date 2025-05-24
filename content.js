class QCMExtractor {
    constructor() {
        this.questions = [];
        this.lastProcessedMessageId = null;
        this.debounceTimer = null;
        this.init();
    }

    init() {
        this.createFloatingButton();
        this.observeMessages();
    }

    createFloatingButton() {
        if (document.getElementById('qcm-float-btn')) return;
        
        const container = document.createElement('div');
        container.id = 'qcm-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;
        
        const button = document.createElement('div');
        button.id = 'qcm-float-btn';
        button.innerHTML = '📝 QCM';
        button.onclick = () => this.togglePanel();
        button.title = 'Open QCM panel';
        
        const refreshBtn = document.createElement('div');
        refreshBtn.id = 'qcm-refresh-btn';
        refreshBtn.innerHTML = '🔄';
        refreshBtn.onclick = () => this.manualRefresh();
        refreshBtn.title = 'Refresh & check for QCM';
        refreshBtn.style.cssText = `
            background: #FF9800;
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
            user-select: none;
            text-align: center;
        `;
        
        container.appendChild(button);
        container.appendChild(refreshBtn);
        document.body.appendChild(container);
    }
    
    manualRefresh() {
        console.log('=== MANUAL REFRESH ===');
        const refreshBtn = document.getElementById('qcm-refresh-btn');
        
        // Visual feedback
        refreshBtn.innerHTML = '⏳';
        refreshBtn.style.background = '#666';
        
        setTimeout(() => {
            this.forceDetectQCM();
            refreshBtn.innerHTML = '🔄';
            refreshBtn.style.background = '#FF9800';
        }, 500);
    }
    
    forceDetectQCM() {
        console.log('Force detecting QCM...');
        
        // Try multiple selectors for ChatGPT messages
        const selectors = [
            '[data-message-author-role="assistant"]',
            '[data-testid*="conversation-turn"] [data-message-author-role="assistant"]',
            '.group\\/conversation-turn [data-message-author-role="assistant"]',
            '[class*="group"][class*="conversation"] [data-message-author-role="assistant"]'
        ];
        
        let messages = [];
        for (const selector of selectors) {
            messages = document.querySelectorAll(selector);
            if (messages.length > 0) {
                console.log(`Found ${messages.length} messages with selector: ${selector}`);
                break;
            }
        }
        
        if (messages.length === 0) {
            console.log('No messages found, trying alternative approach...');

            // Try <pre> or <code> blocks first (used by ChatGPT for code)
            const preBlocks = document.querySelectorAll('pre, code');
            for (const block of preBlocks) {
                const text = block.textContent || '';
                if (text.includes('1.') && text.includes('A)') && text.length > 100) {
                    messages = [block];
                    console.log('Found potential QCM in pre/code block:', text.substring(0, 100));
                    break;
                }
            }

            // If still nothing, try all <div> blocks
            if (messages.length === 0) {
                const allDivs = document.querySelectorAll('div');
                for (const div of allDivs) {
                    const text = div.textContent || '';
                    if (text.includes('1.') && text.includes('A)') && text.length > 100) {
                        messages = [div];
                        console.log('Found potential QCM in div:', text.substring(0, 100));
                        break;
                    }
                }
            }
        }

        
        if (messages.length === 0) {
            alert('No ChatGPT messages found! Make sure you\'re on a ChatGPT conversation page.');
            return;
        }


        
        const lastMessage = messages[messages.length - 1];
        
        // Try multiple ways to get the full text content
        let text = '';
        
        // Method 1: innerHTML then strip HTML
        if (lastMessage.innerHTML) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = lastMessage.innerHTML;
            text = tempDiv.textContent || tempDiv.innerText || '';
        }
        
        // Method 2: textContent if innerHTML didn't work
        if (!text || text.length < 500) {
            text = lastMessage.textContent || '';
        }
        
        // Method 3: innerText if others failed
        if (!text || text.length < 500) {
            text = lastMessage.innerText || '';
        }
        
        // Method 4: Get all text nodes recursively
        if (!text || text.length < 500) {
            text = this.getAllTextContent(lastMessage);
        }
        
        console.log('=== FULL MESSAGE CONTENT ===');
        console.log('Method used, text length:', text.length);
        console.log('First 500 chars:', text.substring(0, 500));
        console.log('Last 200 chars:', text.slice(-200));
        console.log('Contains "Intelligence":', text.includes('Intelligence'));
        console.log('Contains "D)":', text.includes('D)'));
        
        // Reset the processed message ID to force reprocessing
        this.lastProcessedMessageId = null;
        
        this.questions = this.parseQuestions(text);
        console.log('Parsed questions:', this.questions);
        
        if (this.questions.length > 0) {
            this.showQCMIndicator();
            alert(`Found ${this.questions.length} questions! Click the QCM button to answer.`);
        } else {
            this.hideQCMIndicator();
            alert('No QCM questions detected. Check console for debug info.');
        }
    }
    
    getAllTextContent(element) {
        let text = '';
        
        function traverse(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent + ' ';
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // Add line breaks for certain elements
                if (['BR', 'P', 'DIV'].includes(node.tagName)) {
                    text += '\n';
                }
                for (let child of node.childNodes) {
                    traverse(child);
                }
            }
        }
        
        traverse(element);
        return text.trim();
    }

    observeMessages() {
        const observer = new MutationObserver(() => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.detectQCM();
            }, 500);
        });
        
        const chatContainer = document.querySelector('[data-testid="conversation-turn-1"]')?.parentElement || 
                             document.querySelector('main') || 
                             document.body;
        
        observer.observe(chatContainer, {
            childList: true,
            subtree: false
        });
    }

    detectQCM() {
        try {
            const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
            if (messages.length === 0) return;
            
            const lastMessage = messages[messages.length - 1];
            const messageId = lastMessage.getAttribute('data-message-id') || messages.length;
            
            if (messageId === this.lastProcessedMessageId) return;
            
            const text = lastMessage.textContent || '';

            this.questions = this.parseQuestions(text);
            
            if (this.questions.length > 0) {
                this.showQCMIndicator();
            } else {
                this.hideQCMIndicator();
            }
            
            this.lastProcessedMessageId = messageId;
        } catch (e) {
            console.log('QCM Detection error:', e);
        }
    }

    parseQuestions(text) {
        const questions = [];
        
        // Updated regex: no more bold markers
        const questionPattern = /(\d+)\.\s*([^\n]+?)\n((?:[A-Z]\)[^\n]*\n?)+)/g;
        let match;

        while ((match = questionPattern.exec(text)) !== null) {
            const questionNum = match[1];
            const questionText = match[2].trim();
            const optionsText = match[3];

            // Extract options
            const optionMatches = optionsText.match(/[A-Z]\)\s*[^\n]+/g);
            if (!optionMatches || optionMatches.length < 2) continue;

            const options = optionMatches.map(opt => {
                const letter = opt.charAt(0);
                const content = opt.substring(2).trim();
                return { letter, content };
            });

            questions.push({
                id: parseInt(questionNum),
                question: questionText,
                options: options
            });
        }

        return questions;
    }


    showQCMIndicator() {
        const btn = document.getElementById('qcm-float-btn');
        if (btn) {
            btn.style.background = '#4CAF50';
            btn.innerHTML = '📝 QCM (' + this.questions.length + ')';
            btn.classList.add('pulse');
        }
    }

    hideQCMIndicator() {
        const btn = document.getElementById('qcm-float-btn');
        if (btn) {
            btn.style.background = '#667eea';
            btn.innerHTML = '📝 QCM';
            btn.classList.remove('pulse');
        }
    }

    togglePanel() {
        const panel = document.getElementById('qcm-panel');
        if (panel) {
            panel.remove();
            return;
        }
        this.createPanel();
    }

    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'qcm-panel';
        panel.innerHTML = this.generatePanelHTML();
        document.body.appendChild(panel);
        this.attachEventListeners();
    }

    generatePanelHTML() {
        if (this.questions.length === 0) {
            return `
                <div class="qcm-header">
                    <h3>No QCM Detected</h3>
                    <button class="close-btn">✕</button>
                </div>
                <div class="qcm-content">
                    <p>No questions found. Try asking for a QCM with this format:<br><strong>1. Question?</strong><br>A) Option A<br>B) Option B</p>
                </div>
            `;
        }

        let html = `
            <div class="qcm-header">
                <h3>QCM Questions (${this.questions.length})</h3>
                <button class="close-btn">✕</button>
            </div>
            <div class="qcm-content">
        `;

        this.questions.forEach(q => {
            html += `<div class="question-block">
                <div class="question-title">Question ${q.id}: ${this.escapeHtml(q.question)}</div>
                <div class="options">`;
            
            q.options.forEach(opt => {
                html += `<label class="option">
                    <input type="checkbox" data-question="${q.id}" data-option="${opt.letter}">
                    <span>${opt.letter}) ${this.escapeHtml(opt.content)}</span>
                </label>`;
            });
            
            html += '</div></div>';
        });

        html += `</div><div class="qcm-footer">
            <button id="submit-answers">Submit Answers</button>
        </div>`;

        return html;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    attachEventListeners() {
        const panel = document.getElementById('qcm-panel');
        if (!panel) return;

        panel.querySelector('.close-btn').onclick = () => panel.remove();
        
        const submitBtn = panel.querySelector('#submit-answers');
        if (submitBtn) {
            submitBtn.onclick = () => this.submitAnswers();
        }
    }

    submitAnswers() {
        const checkboxes = document.querySelectorAll('#qcm-panel input:checked');
        const answers = {};
        
        checkboxes.forEach(cb => {
            const qId = cb.dataset.question;
            const option = cb.dataset.option;
            if (!answers[qId]) answers[qId] = [];
            answers[qId].push(option);
        });
        
        let output = '';
        Object.keys(answers).forEach(qId => {
            output += `Answer Question ${qId}: ${answers[qId].join(' & ')}\n`;
        });
        
        if (output) {
            this.insertIntoChat(output.trim());
            document.getElementById('qcm-panel').remove();
        }
    }

    insertIntoChat(text) {
        const textarea = document.querySelector('#prompt-textarea') || 
                        document.querySelector('textarea[placeholder*="Message"]');
        
        if (textarea) {
            textarea.value = text;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            
            setTimeout(() => {
                const sendBtn = document.querySelector('[data-testid="send-button"]');
                if (sendBtn && !sendBtn.disabled) sendBtn.click();
            }, 200);
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => new QCMExtractor(), 1000);
    });
} else {
    setTimeout(() => new QCMExtractor(), 1000);
}