/**
 * Processes a snippet text to extract variables and prompt the user for values
 * @param {string} snippetText - The snippet text containing variables in $varname$ format
 * @returns {Promise<string>} - The processed snippet with variables replaced by user values
 */
async function processSnippetVariables(snippetText) {
    const variables = extractVariables(snippetText);
    if (variables.length === 0) return snippetText;
    
    const values = await promptForVariables(variables);
    if (values === null) return null;
    
    let processedText = snippetText;
    
    // For HTML content, we need to be careful with the replacement
    const isHtml = /<[a-z][\s\S]*>/i.test(snippetText);
    
    if (isHtml) {
        // For HTML content, use a DOM parser to safely replace variables
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = snippetText;
        
        // Process text nodes to replace variables
        const textNodes = [];
        const walker = document.createTreeWalker(
            tempDiv,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }
        
             textNodes.forEach(textNode => {
            let content = textNode.nodeValue;
            variables.forEach((variable, index) => {
                const placeholder = `$${variable}$`;
                const value = values[index] || '';
                content = content.replace(new RegExp('\\$' + variable + '\\$', 'g'), value);
            });
            textNode.nodeValue = content;
        });
        
        processedText = tempDiv.innerHTML;
    } else {
        // For plain text, simple string replacement is fine
        variables.forEach((variable, index) => {
            const value = values[index] || '';
            processedText = processedText.replace(new RegExp('\\$' + variable + '\\$', 'g'), value);
        });
    }
    
    return processedText;
}

function extractVariables(text) {
    const variablePattern = /\$([a-zA-Z_][a-zA-Z0-9_]*)\$/g;
    const variables = [];
    let match;
    while ((match = variablePattern.exec(text)) !== null) {
        const variable = match[1];
        if (!variables.includes(variable)) {
            variables.push(variable);
        }
    }
    return variables;
}

async function promptForVariables(variables) {
    return new Promise((resolve) => {
        const dialog = createVariableDialog(variables, resolve);
        document.body.appendChild(dialog);
        const firstInput = dialog.querySelector('input[type="text"]');
        if (firstInput) firstInput.focus();
    });
}

function createVariableDialog(variables, resolve) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
    const dialog = document.createElement('div');
    dialog.style.cssText = 'background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; font-family: Arial, sans-serif;';
    const title = document.createElement('h3');
    title.textContent = 'Enter Variable Values';
    title.style.cssText = 'margin-top: 0; color: #172B4D; margin-bottom: 15px;';
    dialog.appendChild(title);
    const form = document.createElement('form');
    variables.forEach((variable, index) => {
        const fieldGroup = document.createElement('div');
        fieldGroup.style.cssText = 'margin-bottom: 15px;';
        const label = document.createElement('label');
        label.textContent = `${variable}:`;
        label.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold; color: #172B4D;';
        const input = document.createElement('input');
        input.type = 'text';
        input.name = variable;
        input.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #DFE1E6; border-radius: 3px; box-sizing: border-box; font-size: 14px;';
        fieldGroup.appendChild(label);
        fieldGroup.appendChild(input);
        form.appendChild(fieldGroup);
        if (index === 0) input.focus();
    });
    const buttonGroup = document.createElement('div');
    buttonGroup.style.cssText = 'display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;';
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = 'padding: 8px 16px; background: #FFFFFF; color: #172B4D; border: 1px solid #DFE1E6; border-radius: 3px; cursor: pointer;';
    const insertButton = document.createElement('button');
    insertButton.type = 'submit';
    insertButton.textContent = 'Insert Snippet';
    insertButton.style.cssText = 'padding: 8px 16px; background: #0052CC; color: white; border: none; border-radius: 3px; cursor: pointer;';
    buttonGroup.appendChild(cancelButton);
    buttonGroup.appendChild(insertButton);
    form.appendChild(buttonGroup);
    dialog.appendChild(form);
    overlay.appendChild(dialog);
    
    function cleanup() {
        overlay.remove();
    }
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const values = [];
        variables.forEach(variable => {
            const input = form.querySelector(`input[name="${variable}"]`);
            values.push(input ? input.value : '');
        });
        cleanup();
        resolve(values);
    });
    
    cancelButton.addEventListener('click', () => {
        cleanup();
        resolve(null);
    });
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            cleanup();
            resolve(null);
        }
    });
    
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            document.removeEventListener('keydown', escHandler);
            cleanup();
            resolve(null);
        }
    });
    
    return overlay;
}

/**
 * Shows a notification to the user that a variable was not provided
 * @param {string} variableName - The name of the missing variable
 * @param {number} tabId - The ID of the current tab
 */
export function showMissingVariableNotification(variableName, tabId) {
    chrome.scripting.executeScript({
        target: { tabId },
        func: (varName) => {
            // Create notification element
            const notification = document.createElement('div');
            notification.textContent = `Missing value for variable: ${varName}`;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #FFEBE6;
                color: #BF2600;
                padding: 12px 16px;
                border-radius: 3px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                font-family: Arial, sans-serif;
                z-index: 10000;
                border-left: 4px solid #BF2600;
            `;
            
            document.body.appendChild(notification);
            
            // Auto-remove after 3 seconds
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.3s';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        },
        args: [variableName]
    });
}

export function showVariableHint(message, timeout = 3000) {
    const hint = document.createElement('div');
    hint.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #0052CC; color: white; padding: 12px 16px; border-radius: 4px; z-index: 10001; font-family: Arial, sans-serif; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);';
    hint.textContent = message;
    document.body.appendChild(hint);
    setTimeout(() => {
        if (hint.parentNode) {
            hint.parentNode.removeChild(hint);
        }
    }, timeout);
}