template = {
render: function(model){var output='';
output+='<div';output+=' class="test"';output+='>';output+=this.span1.call(this, model);output+=this.div2.call(this, model);output+='</div>';
;return output;}, span3: function(model){var output='';
model.product.tags.forEach(function(tag){ var model= {tag:tag};
output+='<span';output+='>';output+='  ' + model.tag/*ref*/;
output+='</span>';
}.bind(this));return output;}, span1: function(model){var output='';
output+='<span';output+='>';output+='  ' + model.title/*ref*/;
output+='</span>';
;return output;}, div2: function(model){var output='';
model.products.forEach(function(product){ var model= {product:product};
output+='<div';output+='>';output+='  ' + model.product.name/*ref*/;
output+=this.span3.call(this, model);output+='</div>';
}.bind(this));return output;}};
