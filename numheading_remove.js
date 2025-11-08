function removeIndex() {
    // Try to find headings in both Cloud editor and DataCenter 9.x editor
    var headings = document.querySelectorAll(".ak-editor-content-area .ProseMirror h1, .ak-editor-content-area .ProseMirror h2, .ak-editor-content-area .ProseMirror h3, .ak-editor-content-area .ProseMirror h4, .ak-editor-content-area .ProseMirror h5, .ak-editor-content-area .ProseMirror h6");

    // If no headings found in Cloud editor, try the DataCenter 9.x editor
    if (headings.length === 0) {
        // Check if we're in an iframe with TinyMCE
        try {
            const iframes = document.querySelectorAll('iframe');
            for (let i = 0; i < iframes.length; i++) {
                try {
                    const iframe = iframes[i];
                    const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
                    
                    if (iframeDocument.body && iframeDocument.body.id === 'tinymce') {
                        headings = iframeDocument.querySelectorAll("h1, h2, h3, h4, h5, h6");
                        break;
                    }
                } catch (e) {
                    // Skip cross-origin iframes
                    console.log("Could not access iframe content:", e);
                }
            }
        } catch (e) {
            console.error("Error accessing iframes:", e);
        }
    }

    // Process the headings to remove numbering
    headings.forEach(function(heading) {            
        heading.innerHTML = removeNo(heading.innerHTML);
    });
}

function removeNo(str) {
    let newstr = str.trim();
    newstr = newstr.replace(/[\u00A0\u1680​\u180e\u2000-\u2009\u200a​\u200b​\u202f\u205f​\u3000]/g,' ');
    if(IsNumeric(newstr.substring(0, newstr.indexOf(' ')))){
        return newstr.substring(newstr.indexOf(' ')+1).trim();
    }
    return newstr;
}

function IsNumeric(num) {
    num = num.split('.').join("");
    return (num >=0 || num < 0);
}

// Run the main function
removeIndex();