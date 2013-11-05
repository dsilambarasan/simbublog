(function($) {
  Drupal.behaviors.required_fields = {
    attach: function (context, settings) {
    /*  $('#edit-submit', context).click(function() {
        var consolidate_value = [];
        $('.form-select').each(function() {
          var oldvalue = $(this).closest('tr').find('td:first-child input:checkbox').val();
          //$(this).closest('tr').find('td:last-child input').val(oldvalue + ' === ' + $(this).val());
          consolidate_value.push(oldvalue + ' === ' + $(this).val());
        });
        $('#hidden_content').val(consolidate_value);
      }); */

      $('.mark').click(function(event) {
        event.preventDefault();
        var parent = $(this).closest('tr');
        var field = parent.find('td div.field').html();
        var ctype = parent.find('td div.type').html();

	$.ajax({
  type: "POST",
  url: 'admin/content/required_fields/field/update',
  data: {
    'field' : field,
    'ctype' : ctype
  },
  dataType: "json",
  success: function (data) {
    if (data.message) {
      //$("#content-column").prepend('<div class="messages status">' + data.message + '</div>');
    }
  },
  error: function (xmlhttp) {
    alert('An error occured: ' + xmlhttp.status);
  }
});        



      });
    }
  }
})(jQuery);

