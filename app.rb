# app.rb
require 'sinatra'
require 'sinatra/flash'
require 'stripe'

class HelloWorldApp < Sinatra::Base
  set :views, File.dirname(__FILE__) + '/views'
  set :public_folder, File.dirname(__FILE__) + '/public'
  set :show_exceptions, false
  enable :sessions
  register Sinatra::Flash

  Stripe.api_key = ENV['STRIPE_SECRET_KEY']

  MAX_AMOUNT_WITHOUT_3DSECURE = 4999
  CURRENCY = 'usd'
  PAYMENT_AMOUNT = 5000

  get '/' do
    @amount = PAYMENT_AMOUNT
    @currency = CURRENCY
    @create3DSecureSource = (@amount > MAX_AMOUNT_WITHOUT_3DSECURE)
    flash[:error] = ''
  
    erb :form
  end

  post '/your-charge-code' do
    begin
      
      @amount = PAYMENT_AMOUNT
      @currency = CURRENCY

      # Get the payment source submitted by the form:
      sourceID = params[:stripeSource]
      source = Stripe::Source.retrieve(sourceID)

      if ((@amount > MAX_AMOUNT_WITHOUT_3DSECURE) && 
          (source["type"] != "three_d_secure"))
        flash[:error] = '3D Secure authentication is required for this ' +
                        'payment. Please try again.'
        redirect "/"
        return
      end

      if ((source["type"] == "three_d_secure") && 
          (source["redirect"]["status"] != "succeeded" || 
           source["three_d_secure"]["authenticated"] == false))
        flash[:error] = '3D Secure authentication failed. ' + 
                        'Please try again.'
        redirect "/"
        return
      end 
      
      # Charge the user's card:
      charge = Stripe::Charge.create(
        :amount => @amount,
        :currency => @currency,
        :description => "Example charge",
        :source => sourceID,
      )
      redirect '/thankyou'
    
    rescue => e
      flash[:error] = 'Sorry, your payment did not go through. ' + 
                      'Please try again.'
      redirect "/"  
    end
  end

  get '/complete' do
    'Thank you! This window will close shortly.'
  end
  get '/thankyou' do
    'Your order is being processed and will ship shortly!'
  end
end