$(function() {
  var $form = $('#payment-form');
  $form.submit(function(event) {
    // Disable the submit button to prevent repeated clicks:
    $form.find('.submit').prop('disabled', true);

    // Create a source
    Stripe.source.create({
      type: 'card', 
      card: {
        number: $('.card-number').val(),
        cvc: $('.card-cvc').val(),
        exp_month: $('.card-expiry-month').val(),
        exp_year: $('.card-expiry-year').val(),
      }, 
      owner: {
        address: {
          postal_code: $('.address_zip').val()
        }
      }
    }, stripeCardSourceResponseHandler);
    
    // Prevent the form from being submitted:
    return false;
  });
});

function stripeCardSourceResponseHandler(status, response) {
  // Grab the form:
  var $form = $('#payment-form');

  if (response.error) { // Problem!
    // Show the errors on the form:
    $form.find('.payment-errors').text(response.error.message);
    $form.find('.submit').prop('disabled', false); // Re-enable submission

  } else {
    // Get the source ID:
    var cardSource = response.id;

    // Check to see if we need to create a 3D Secure source
    var create3DSecureSource = ($('.create3DSecureSource').val() === "true");

    if (create3DSecureSource) {
      // Create a 3D Secure Source
      Stripe.source.create({
        type: 'three_d_secure',
        amount: parseInt($('.amount').val()),
        currency: $('.currency').val(),
        three_d_secure: {
          card: cardSource
        }, 
        redirect: {
          return_url: "http://localhost:9292/complete"
        }
      }, stripe3DSecureSourceResponseHandler);

    } else {
      // If we're only creating a Card source, insert the source ID 
      // into the form so it gets submitted to the server:
      $form.append($('<input type="hidden" name="stripeSource">').val(cardSource));

      // Submit the form:
      $form.get(0).submit();
    }
  }
};

function stripe3DSecureSourceResponseHandler(status, response) {
  // Grab the form:
  var $form = $('#payment-form');

  if (response.error) { // Problem!

    // Show the errors on the form:
    $form.find('.payment-errors').text(response.error.message);
    $form.find('.submit').prop('disabled', false); // Re-enable submission

  } else {
    // Get the source ID:
    var threeDSecureSource = response.id;
    
    // Insert the source ID into the form so it gets submitted to the server:
    $form.append($('<input type="hidden" name="stripeSource">').val(threeDSecureSource));

    var authenticatedStatus = response.three_d_secure.authenticated;
    var redirectStatus = response.redirect.status;
    var redirectURL = response.redirect.url;
    
    if (redirectStatus == 'succeeded' || authenticatedStatus == true) {
      // this card either does not support 3D Secure authentication or the issuer does not require it
      // for this charge. Therefore, we can submit the form.

      // Submit the form:
      $form.get(0).submit();
    }
    
    // we need to have the customer go through the redirect
    fmodal = $.featherlight({
      iframe: redirectURL,
      iframeMaxWidth: '80%',
      iframeWidth: 500,
      iframeHeight: 300,
      closeOnClick: false,
      closeOnEsc: false,
      closeIcon: ''
    });
    
    // start polling to catch when source becomes chargeable
    startSourcePolling(response, fmodal);
  }
};

function startSourcePolling(response, modal) {
  // Grab the form:
  var $form = $('#payment-form');

  // Poll for source status
  Stripe.source.poll(
    response.id,
    response.client_secret,
    function(status, source) {
      
      // Check if the source has been activated
      if (source.status == 'pending') {
        // Status is still pending. Lets return and wait for a status update.
        return;
      }

      if (source.status == 'chargeable') {  
        // Get the source ID:
        var sourceID = response.id;
        
        // Insert the source ID into the form so it gets submitted to the server:
        $form.append($('<input type="hidden" name="stripeSource">').val(sourceID));

        // Submit the form:
        $form.get(0).submit();

      } else if (source.status == 'failed') {
        
        var msg = '3D Secure authentication failed. Please try again.';
        
        // Show the errors on the form:
        $form.find('.payment-errors').text(msg);
        $form.find('.submit').prop('disabled', false); // Re-enable submission
      }
      
      // Cancel the source polling
      Stripe.source.cancelPoll(response.id);
      
      // close modal
      modal.close();

  });
}