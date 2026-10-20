// Exercise the same visible sidebar routes used by the product.
exports.selectScope = async (page,id) => {
 const guide=page.locator('#chanlume-guide-section');
 if(id==='all'){await guide.locator('[data-cl-action=subscriptions]').click();return;}
 const target=guide.locator(`[data-cl-group="${id}"]`);
 if(!await target.isVisible())await guide.locator(`[data-cl-action=${id==='unfiled'?'toggle-channels':'toggle-guide'}]`).click();
 await target.click();
};
